$filePath = "C:\Users\allof\Desktop\251212 GIS\rkpu-viewer\src\App.jsx"
$content = Get-Content -Path $filePath -Raw -Encoding UTF8

# 교체할 패턴 (NOTAM dropdown wrapper 전체)
$oldPattern = '        <div className="notam-dropdown-wrapper">'

# 새로운 NotamPanel 컴포넌트
$newContent = '        <NotamPanel
          showNotamPanel={showNotamPanel}
          setShowNotamPanel={setShowNotamPanel}
          notamData={notamData}
          notamLoading={notamLoading}
          notamError={notamError}
          notamCacheAge={notamCacheAge}
          notamPeriod={notamPeriod}
          setNotamPeriod={setNotamPeriod}
          notamLocationFilter={notamLocationFilter}
          setNotamLocationFilter={setNotamLocationFilter}
          notamFilter={notamFilter}
          setNotamFilter={setNotamFilter}
          notamExpanded={notamExpanded}
          setNotamExpanded={setNotamExpanded}
          notamLocationsOnMap={notamLocationsOnMap}
          setNotamLocationsOnMap={setNotamLocationsOnMap}
          fetchNotamData={fetchNotamData}
        />'

# 라인별로 처리
$lines = Get-Content -Path $filePath -Encoding UTF8
$newLines = @()
$skipUntilEnd = $false
$braceCount = 0

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]

    if ($line -match '^\s*<div className="notam-dropdown-wrapper">') {
        # NotamPanel 컴포넌트로 교체
        $newLines += $newContent
        $skipUntilEnd = $true
        $braceCount = 1
        continue
    }

    if ($skipUntilEnd) {
        # </div> 태그 카운팅
        $openTags = ([regex]::Matches($line, '<div')).Count
        $closeTags = ([regex]::Matches($line, '</div>')).Count
        $braceCount += $openTags - $closeTags

        if ($braceCount -le 0) {
            $skipUntilEnd = $false
        }
        continue
    }

    $newLines += $line
}

$newLines | Out-File -FilePath $filePath -Encoding UTF8
Write-Host "File updated successfully"
