// Vercel Serverless Function - OpenSky Trino Historical Flight Data API
// Fetches complete flight history from takeoff to landing

const TRINO_HOST = 'trino.opensky-network.org';
const TRINO_PORT = 8080;  // OpenSky Trino uses HTTP on port 8080
const OPENSKY_USER = process.env.OPENSKY_USERNAME || 'danielkim';
const OPENSKY_PASS = process.env.OPENSKY_PASSWORD || '';
const TRINO_PROTOCOL = 'https';  // OpenSky uses HTTPS with port 8080

/**
 * Execute a Trino query via REST API
 */
async function executeTrinoQuery(query) {
  const auth = Buffer.from(`${OPENSKY_USER}:${OPENSKY_PASS}`).toString('base64');

  // Initial query submission
  const response = await fetch(`${TRINO_PROTOCOL}://${TRINO_HOST}:${TRINO_PORT}/v1/statement`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'X-Trino-User': OPENSKY_USER,
      'X-Trino-Catalog': 'minio',
      'X-Trino-Schema': 'osky',
      'Content-Type': 'text/plain',
    },
    body: query,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Trino query failed: ${response.status} - ${text}`);
  }

  let result = await response.json();
  let allData = [];
  let columns = result.columns || [];

  // Collect data from first response
  if (result.data) {
    allData = allData.concat(result.data);
  }

  // Poll for more results if nextUri exists
  while (result.nextUri) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between polls

    const nextResponse = await fetch(result.nextUri, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'X-Trino-User': OPENSKY_USER,
      },
    });

    if (!nextResponse.ok) {
      break;
    }

    result = await nextResponse.json();

    if (result.columns && !columns.length) {
      columns = result.columns;
    }

    if (result.data) {
      allData = allData.concat(result.data);
    }

    // Safety limit
    if (allData.length > 50000) {
      break;
    }
  }

  return { columns, data: allData };
}

/**
 * Convert Trino results to objects
 */
function resultsToObjects(columns, data) {
  if (!columns || !data) return [];
  const colNames = columns.map(c => c.name);
  return data.map(row => {
    const obj = {};
    colNames.forEach((name, i) => {
      obj[name] = row[i];
    });
    return obj;
  });
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { icao24, date, hours } = req.query;

  if (!icao24) {
    return res.status(400).json({ error: 'icao24 parameter is required' });
  }

  try {
    // Calculate time range
    let startTime, endTime;

    if (date) {
      // Specific date: get full day
      const dateObj = new Date(date + 'T00:00:00Z');
      startTime = Math.floor(dateObj.getTime() / 1000);
      endTime = startTime + 86400; // 24 hours
    } else {
      // Default: last N hours (default 24)
      const hoursBack = parseInt(hours) || 24;
      endTime = Math.floor(Date.now() / 1000);
      startTime = endTime - (hoursBack * 3600);
    }

    // Calculate hour partitions for efficient querying
    const startHour = Math.floor(startTime / 3600) * 3600;
    const endHour = Math.floor(endTime / 3600) * 3600;

    // Query state_vectors_data4 for detailed position/altitude data
    const query = `
      SELECT
        time,
        lat,
        lon,
        baroaltitude,
        geoaltitude,
        velocity,
        heading,
        vertrate,
        callsign,
        onground
      FROM state_vectors_data4
      WHERE icao24 = '${icao24.toLowerCase()}'
        AND hour >= ${startHour}
        AND hour <= ${endHour}
        AND time >= ${startTime}
        AND time <= ${endTime}
        AND lat IS NOT NULL
        AND lon IS NOT NULL
      ORDER BY time ASC
    `;

    console.log('Executing Trino query for icao24:', icao24);
    console.log('Trino endpoint:', `${TRINO_PROTOCOL}://${TRINO_HOST}:${TRINO_PORT}/v1/statement`);
    console.log('Time range:', new Date(startTime * 1000).toISOString(), '~', new Date(endTime * 1000).toISOString());
    const { columns, data } = await executeTrinoQuery(query);
    const results = resultsToObjects(columns, data);

    // Convert to graph-friendly format
    const path = results.map(r => ({
      time: r.time,
      lat: r.lat,
      lon: r.lon,
      altitude_ft: r.baroaltitude ? Math.round(r.baroaltitude * 3.28084) :
                   r.geoaltitude ? Math.round(r.geoaltitude * 3.28084) : 0,
      altitude_m: r.baroaltitude || r.geoaltitude || 0,
      velocity_kts: r.velocity ? Math.round(r.velocity * 1.94384) : 0,
      heading: r.heading,
      vertrate_fpm: r.vertrate ? Math.round(r.vertrate * 196.85) : 0,
      callsign: r.callsign?.trim(),
      on_ground: r.onground,
    }));

    // Downsample if too many points (keep ~500 points max for performance)
    let sampledPath = path;
    if (path.length > 500) {
      const step = Math.ceil(path.length / 500);
      sampledPath = path.filter((_, i) => i % step === 0 || i === path.length - 1);
    }

    return res.status(200).json({
      icao24: icao24.toLowerCase(),
      startTime,
      endTime,
      totalPoints: path.length,
      sampledPoints: sampledPath.length,
      path: sampledPath,
      source: 'opensky-trino',
    });

  } catch (error) {
    console.error('OpenSky Trino error:', error);
    return res.status(500).json({
      error: 'Failed to fetch flight history',
      details: error.message,
      path: [],
    });
  }
}
