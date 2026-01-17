/**
 * Airport Constants
 * 전세계 공항 정보 데이터베이스
 */

export interface AirportInfo {
  name: string;
  country: string;
  type: 'hub' | 'general' | 'private' | 'military' | 'fir';
  region?: string;
  note?: string;
}

export interface CountryInfo {
  name: string;
  flag: string;
  prefix: string;
}

export interface AirportCoordinate {
  lat: number;
  lon: number;
}

export interface DetailedAirportInfo extends AirportInfo {
  icao: string;
  countryName: string;
  flag: string;
  typeLabel: string;
  coordinates: AirportCoordinate | null;
}

// 전세계 공항 정보 (ICAO 코드 -> 정보)
export const AIRPORT_DATABASE: Record<string, AirportInfo> = {
  // ========== 대한민국 (RK) ==========
  // 거점공항 (Hub Airports)
  RKSI: { name: '인천국제공항', country: 'KR', type: 'hub', region: '중부권' },
  RKSS: { name: '김포국제공항', country: 'KR', type: 'hub', region: '중부권' },
  RKPK: { name: '김해국제공항', country: 'KR', type: 'hub', region: '동남권', note: '공군 제5공중기동비행단' },
  RKPC: { name: '제주국제공항', country: 'KR', type: 'hub', region: '제주권' },
  RKTN: { name: '대구국제공항', country: 'KR', type: 'hub', region: '대경권', note: '공군 공중전투사령부' },
  RKTU: { name: '청주국제공항', country: 'KR', type: 'hub', region: '중부권', note: '공군 제17전투비행단' },
  RKJB: { name: '무안국제공항', country: 'KR', type: 'hub', region: '서남권' },

  // 일반공항 (General Airports)
  RKNY: { name: '양양국제공항', country: 'KR', type: 'general', region: '중부권' },
  RKPU: { name: '울산공항', country: 'KR', type: 'general', region: '동남권' },
  RKJY: { name: '여수공항', country: 'KR', type: 'general', region: '서남권' },
  RKPS: { name: '사천공항', country: 'KR', type: 'general', region: '동남권', note: '공군 제3훈련비행단' },
  RKTH: { name: '포항경주공항', country: 'KR', type: 'general', region: '대경권', note: '해군 항공사령부' },
  RKJK: { name: '군산공항', country: 'KR', type: 'general', region: '서남권', note: '미공군 제8전투비행단' },
  RKNW: { name: '원주공항', country: 'KR', type: 'general', region: '중부권', note: '공군 제8전투비행단' },
  RKTL: { name: '울진비행장', country: 'KR', type: 'general', region: '대경권', note: '한국항공대 훈련용' },
  RKJJ: { name: '광주공항', country: 'KR', type: 'general', region: '서남권', note: '공군 제1전투비행단' },

  // 사설공항 (Private Airports)
  RKRS: { name: '수색비행장', country: 'KR', type: 'private', note: '육군 제11항공단' },
  RKSE: { name: '사곶비행장', country: 'KR', type: 'private', note: '백령도 천연활주로' },
  RKTA: { name: '태안비행장', country: 'KR', type: 'private', note: '한서대학교' },
  RKPD: { name: '정석비행장', country: 'KR', type: 'private', note: '대한항공 훈련용' },
  RKSJ: { name: '잠실헬리패드', country: 'KR', type: 'private' },

  // 군공항 - 육군 (Army)
  RKRN: { name: '이천비행장', country: 'KR', type: 'military', note: '육군 항공작전사령부' },
  RKRD: { name: '덕소비행장', country: 'KR', type: 'military', note: '육군 제11항공단' },
  RKRP: { name: '파주비행장', country: 'KR', type: 'military', note: '육군 제11항공단' },
  RKRG: { name: '광탄비행장', country: 'KR', type: 'military', note: '육군 제11항공단' },
  RKRA: { name: '가납리비행장', country: 'KR', type: 'military', note: '육군 제11항공단' },
  RKRK: { name: '가평비행장', country: 'KR', type: 'military', note: '육군 제15항공단' },
  RKRO: { name: '포천비행장', country: 'KR', type: 'military', note: '육군 제15항공단' },
  RKRY: { name: '용인비행장', country: 'KR', type: 'military', note: '육군 제17항공단' },
  RKMS: { name: '신북비행장', country: 'KR', type: 'military', note: '육군 제12항공단' },
  RKMB: { name: '홍천비행장', country: 'KR', type: 'military', note: '육군 제13항공단' },
  RKMG: { name: '안대리비행장', country: 'KR', type: 'military', note: '육군 제13항공단' },
  RKMA: { name: '현리비행장', country: 'KR', type: 'military', note: '육군 제13항공단' },
  RKND: { name: '속초공항', country: 'KR', type: 'military', note: '육군 제13항공단' },
  RKUY: { name: '영천비행장', country: 'KR', type: 'military', note: '육군 제21항공단' },
  RKJU: { name: '전주비행장', country: 'KR', type: 'military', note: '육군 제21항공단' },

  // 군공항 - 해군 (Navy)
  RKPE: { name: '진해비행장', country: 'KR', type: 'military', note: '해군기지' },
  RKJM: { name: '목포공항', country: 'KR', type: 'military', note: '해군 항공사령부' },

  // 군공항 - 공군 (Air Force)
  RKSM: { name: '서울공항', country: 'KR', type: 'military', note: '공군 제15특수임무비행단' },
  RKSW: { name: '수원공항', country: 'KR', type: 'military', note: '공군 제10전투비행단' },
  RKNN: { name: '강릉공항', country: 'KR', type: 'military', note: '공군 제18전투비행단' },
  RKTE: { name: '성무비행장', country: 'KR', type: 'military', note: '공군사관학교' },
  RKTI: { name: '중원비행장', country: 'KR', type: 'military', note: '공군 제19전투비행단' },
  RKTF: { name: '계룡비행장', country: 'KR', type: 'military', note: '공군본부' },
  RKTP: { name: '서산공항', country: 'KR', type: 'military', note: '공군 제20전투비행단, 2028년 민항 개항예정' },
  RKTY: { name: '예천공항', country: 'KR', type: 'military', note: '공군 제16전투비행단' },

  // 군공항 - 주한미군 (USFK)
  RKSO: { name: '오산공군기지', country: 'KR', type: 'military', note: '주한미군 제7공군' },
  RKSG: { name: '캠프 험프리스', country: 'KR', type: 'military', note: '주한미군 제2보병사단' },
  RKTG: { name: '캠프 워커', country: 'KR', type: 'military', note: '주한미군 헬기기지' },
  RKST: { name: '캠프 스탠리', country: 'KR', type: 'military', note: '주한미군 무인기' },

  // FIR/ACC
  RKRR: { name: '인천FIR', country: 'KR', type: 'fir' },

  // ========== 북한 (ZK) ==========
  ZKKP: { name: '평양FIR', country: 'KP', type: 'fir' },
  ZKPY: { name: '평양순안국제공항', country: 'KP', type: 'hub' },

  // ========== 일본 (RJ) ==========
  RJTT: { name: '도쿄 하네다공항', country: 'JP', type: 'hub' },
  RJAA: { name: '도쿄 나리타공항', country: 'JP', type: 'hub' },
  RJBB: { name: '오사카 간사이공항', country: 'JP', type: 'hub' },
  RJOO: { name: '오사카 이타미공항', country: 'JP', type: 'hub' },
  RJCC: { name: '삿포로 신치토세공항', country: 'JP', type: 'hub' },
  RJGG: { name: '나고야 추부국제공항', country: 'JP', type: 'hub' },
  RJFF: { name: '후쿠오카공항', country: 'JP', type: 'hub' },
  ROAH: { name: '오키나와 나하공항', country: 'JP', type: 'hub' },
  RJFK: { name: '가고시마공항', country: 'JP', type: 'general' },
  RJFT: { name: '구마모토공항', country: 'JP', type: 'general' },
  RJFM: { name: '미야자키공항', country: 'JP', type: 'general' },
  RJFO: { name: '오이타공항', country: 'JP', type: 'general' },
  RJFN: { name: '나가사키공항', country: 'JP', type: 'general' },
  RJFU: { name: '사가공항', country: 'JP', type: 'general' },
  RJBE: { name: '고베공항', country: 'JP', type: 'general' },
  RJOK: { name: '고치공항', country: 'JP', type: 'general' },
  RJOM: { name: '마쓰야마공항', country: 'JP', type: 'general' },
  RJOT: { name: '다카마쓰공항', country: 'JP', type: 'general' },
  RJOH: { name: '요나고공항', country: 'JP', type: 'general' },
  RJOB: { name: '오카야마공항', country: 'JP', type: 'general' },
  RJOC: { name: '이즈모공항', country: 'JP', type: 'general' },
  RJOA: { name: '히로시마공항', country: 'JP', type: 'general' },
  RJOS: { name: '도쿠시마공항', country: 'JP', type: 'general' },
  RJNT: { name: '도야마공항', country: 'JP', type: 'general' },
  RJNK: { name: '고마쓰공항', country: 'JP', type: 'general' },
  RJNS: { name: '시즈오카공항', country: 'JP', type: 'general' },
  RJNN: { name: '나고야 고마키공항', country: 'JP', type: 'general' },
  RJSN: { name: '니가타공항', country: 'JP', type: 'general' },
  RJSS: { name: '센다이공항', country: 'JP', type: 'general' },
  RJSF: { name: '후쿠시마공항', country: 'JP', type: 'general' },
  RJSK: { name: '아키타공항', country: 'JP', type: 'general' },
  RJSC: { name: '야마가타공항', country: 'JP', type: 'general' },
  RJCH: { name: '하코다테공항', country: 'JP', type: 'general' },
  RJCB: { name: '오비히로공항', country: 'JP', type: 'general' },
  RJCK: { name: '구시로공항', country: 'JP', type: 'general' },
  RJEC: { name: '아사히카와공항', country: 'JP', type: 'general' },
  RJJJ: { name: '후쿠오카FIR', country: 'JP', type: 'fir' },

  // ========== 중국 (Z) ==========
  ZBAA: { name: '베이징 서우두공항', country: 'CN', type: 'hub' },
  ZBAD: { name: '베이징 다싱공항', country: 'CN', type: 'hub' },
  ZSPD: { name: '상하이 푸둥공항', country: 'CN', type: 'hub' },
  ZSSS: { name: '상하이 홍차오공항', country: 'CN', type: 'hub' },
  ZGGG: { name: '광저우 바이윈공항', country: 'CN', type: 'hub' },
  ZGSZ: { name: '선전 바오안공항', country: 'CN', type: 'hub' },
  ZUUU: { name: '청두 솽류공항', country: 'CN', type: 'hub' },
  ZUCK: { name: '충칭 장베이공항', country: 'CN', type: 'hub' },
  ZSHC: { name: '항저우 샤오산공항', country: 'CN', type: 'hub' },
  ZSAM: { name: '샤먼 가오치공항', country: 'CN', type: 'hub' },
  ZLXY: { name: '시안 셴양공항', country: 'CN', type: 'hub' },
  ZSNJ: { name: '난징 루커우공항', country: 'CN', type: 'hub' },
  ZHCC: { name: '정저우 신정공항', country: 'CN', type: 'hub' },
  ZWWW: { name: '우루무치 디워푸공항', country: 'CN', type: 'hub' },
  ZYTL: { name: '다롄 저우수이쯔공항', country: 'CN', type: 'hub' },
  ZYTX: { name: '선양 타오셴공항', country: 'CN', type: 'hub' },
  ZYCC: { name: '창춘 롱자공항', country: 'CN', type: 'hub' },
  ZYHB: { name: '하얼빈 타이핑공항', country: 'CN', type: 'hub' },
  ZSQD: { name: '칭다오 류팅공항', country: 'CN', type: 'hub' },
  ZSJN: { name: '지난 야오창공항', country: 'CN', type: 'hub' },
  ZBPE: { name: '베이징FIR', country: 'CN', type: 'fir' },
  ZGZU: { name: '광저우FIR', country: 'CN', type: 'fir' },
  ZSHA: { name: '상하이FIR', country: 'CN', type: 'fir' },
  ZYSH: { name: '선양FIR', country: 'CN', type: 'fir' },
  ZLHW: { name: '란저우FIR', country: 'CN', type: 'fir' },
  ZPKM: { name: '쿤밍FIR', country: 'CN', type: 'fir' },
  ZWUQ: { name: '우루무치FIR', country: 'CN', type: 'fir' },

  // ========== 대만 (RC) ==========
  RCTP: { name: '타이페이 타오위안공항', country: 'TW', type: 'hub' },
  RCSS: { name: '타이페이 쑹산공항', country: 'TW', type: 'hub' },
  RCMQ: { name: '타이중 칭촨강공항', country: 'TW', type: 'hub' },
  RCKH: { name: '카오슝공항', country: 'TW', type: 'hub' },
  RCAA: { name: '타이페이FIR', country: 'TW', type: 'fir' },

  // ========== 홍콩/마카오 ==========
  VHHH: { name: '홍콩국제공항', country: 'HK', type: 'hub' },
  VMMC: { name: '마카오국제공항', country: 'MO', type: 'hub' },

  // ========== 동남아시아 ==========
  VVNB: { name: '하노이 노이바이공항', country: 'VN', type: 'hub' },
  VVTS: { name: '호치민 떤선녓공항', country: 'VN', type: 'hub' },
  VVDN: { name: '다낭국제공항', country: 'VN', type: 'hub' },
  VTBS: { name: '방콕 수완나품공항', country: 'TH', type: 'hub' },
  VTBD: { name: '방콕 돈므앙공항', country: 'TH', type: 'hub' },
  VTSP: { name: '푸켓국제공항', country: 'TH', type: 'hub' },
  WSSS: { name: '싱가포르 창이공항', country: 'SG', type: 'hub' },
  WMKK: { name: '쿠알라룸푸르공항', country: 'MY', type: 'hub' },
  RPLL: { name: '마닐라 니노이아키노공항', country: 'PH', type: 'hub' },
  RPVM: { name: '세부 막탄공항', country: 'PH', type: 'hub' },
  WIII: { name: '자카르타 수카르노하타공항', country: 'ID', type: 'hub' },
  WADD: { name: '발리 응우라라이공항', country: 'ID', type: 'hub' },

  // ========== 미주/유럽 (일부) ==========
  KLAX: { name: '로스앤젤레스공항', country: 'US', type: 'hub' },
  KJFK: { name: '뉴욕 JFK공항', country: 'US', type: 'hub' },
  KSFO: { name: '샌프란시스코공항', country: 'US', type: 'hub' },
  PHNL: { name: '호놀룰루공항', country: 'US', type: 'hub' },
  PGUM: { name: '괌 원팻공항', country: 'US', type: 'hub' },
  EGLL: { name: '런던 히드로공항', country: 'GB', type: 'hub' },
  LFPG: { name: '파리 샤를드골공항', country: 'FR', type: 'hub' },
  EDDF: { name: '프랑크푸르트공항', country: 'DE', type: 'hub' },
};

// 국가 코드별 정보
export const COUNTRY_INFO: Record<string, CountryInfo> = {
  KR: { name: '대한민국', flag: '🇰🇷', prefix: 'RK' },
  KP: { name: '북한', flag: '🇰🇵', prefix: 'ZK' },
  JP: { name: '일본', flag: '🇯🇵', prefix: 'RJ/RO' },
  CN: { name: '중국', flag: '🇨🇳', prefix: 'Z' },
  TW: { name: '대만', flag: '🇹🇼', prefix: 'RC' },
  HK: { name: '홍콩', flag: '🇭🇰', prefix: 'VH' },
  MO: { name: '마카오', flag: '🇲🇴', prefix: 'VM' },
  VN: { name: '베트남', flag: '🇻🇳', prefix: 'VV' },
  TH: { name: '태국', flag: '🇹🇭', prefix: 'VT' },
  SG: { name: '싱가포르', flag: '🇸🇬', prefix: 'WS' },
  MY: { name: '말레이시아', flag: '🇲🇾', prefix: 'WM' },
  PH: { name: '필리핀', flag: '🇵🇭', prefix: 'RP' },
  ID: { name: '인도네시아', flag: '🇮🇩', prefix: 'WI/WA' },
  US: { name: '미국', flag: '🇺🇸', prefix: 'K/P' },
  GB: { name: '영국', flag: '🇬🇧', prefix: 'EG' },
  FR: { name: '프랑스', flag: '🇫🇷', prefix: 'LF' },
  DE: { name: '독일', flag: '🇩🇪', prefix: 'ED' },
};

// 공항 타입별 한글명
export const AIRPORT_TYPE_LABELS: Record<string, string> = {
  hub: '거점공항',
  general: '일반공항',
  private: '사설공항',
  military: '군공항',
  fir: 'FIR/ACC',
};

// 주요 공항 좌표 (NOTAM 지도 표시용)
export const AIRPORT_COORDINATES: Record<string, AirportCoordinate> = {
  // 대한민국 민간 공항
  RKSI: { lat: 37.4691, lon: 126.4505 },
  RKSS: { lat: 37.5583, lon: 126.7906 },
  RKPK: { lat: 35.1795, lon: 128.9381 },
  RKPC: { lat: 33.5066, lon: 126.4929 },
  RKTN: { lat: 35.8941, lon: 128.6589 },
  RKTU: { lat: 36.7166, lon: 127.4991 },
  RKJB: { lat: 34.9914, lon: 126.3828 },
  RKNY: { lat: 38.0614, lon: 128.6692 },
  RKPU: { lat: 35.5935, lon: 129.3518 },
  RKJY: { lat: 34.8423, lon: 127.6161 },
  RKPS: { lat: 35.0886, lon: 128.0702 },
  RKTH: { lat: 35.9879, lon: 129.4203 },
  RKJK: { lat: 35.9038, lon: 126.6158 },
  RKNW: { lat: 37.4383, lon: 127.9604 },
  RKJJ: { lat: 35.1264, lon: 126.8089 },
  RKNN: { lat: 37.7536, lon: 128.9440 },
  // 대한민국 군용/기타 공항
  RKSM: { lat: 37.4449, lon: 127.1139 },
  RKSW: { lat: 37.2394, lon: 127.0071 },
  RKSO: { lat: 37.0905, lon: 127.0296 },
  RKSG: { lat: 36.9617, lon: 127.0311 },
  RKTI: { lat: 36.7233, lon: 127.4981 },
  RKTP: { lat: 37.5200, lon: 126.7411 },
  RKTY: { lat: 36.6200, lon: 126.3300 },
  RKPD: { lat: 35.1456, lon: 128.6969 },
  RKTL: { lat: 36.8933, lon: 129.4619 },
  RKJM: { lat: 35.8986, lon: 126.9153 },
  RKJU: { lat: 35.6761, lon: 127.8881 },
  RKPE: { lat: 35.0894, lon: 129.0781 },
  RKTE: { lat: 37.0250, lon: 127.8839 },
  RKRO: { lat: 37.5261, lon: 126.9667 },
  // 대한민국 FIR
  RKRR: { lat: 37.0, lon: 127.5 },
  // 일본 주요 공항
  RJTT: { lat: 35.5533, lon: 139.7811 },
  RJAA: { lat: 35.7647, lon: 140.3864 },
  RJBB: { lat: 34.4347, lon: 135.2440 },
  RJOO: { lat: 34.7855, lon: 135.4381 },
  RJFF: { lat: 33.5859, lon: 130.4511 },
  RJCC: { lat: 42.7752, lon: 141.6925 },
  RJGG: { lat: 34.8584, lon: 136.8050 },
  ROAH: { lat: 26.1958, lon: 127.6458 },
  RJFT: { lat: 32.8372, lon: 130.8550 },
  RJFR: { lat: 33.0831, lon: 131.7372 },
  RJFO: { lat: 33.4800, lon: 131.7378 },
  RJFU: { lat: 32.9169, lon: 129.9136 },
  RJOI: { lat: 34.1436, lon: 132.2356 },
  RJJJ: { lat: 33.5, lon: 130.5 },
  // 중국
  ZBAA: { lat: 40.0799, lon: 116.6031 },
  ZSPD: { lat: 31.1434, lon: 121.8052 },
  ZGGG: { lat: 23.3924, lon: 113.2988 },
  ZGSZ: { lat: 22.6393, lon: 113.8107 },
  // 대만
  RCTP: { lat: 25.0777, lon: 121.2330 },
  RCSS: { lat: 25.0694, lon: 121.5517 },
  // 홍콩/마카오
  VHHH: { lat: 22.3080, lon: 113.9185 },
  VMMC: { lat: 22.1496, lon: 113.5925 },
};

// 이전 호환성을 위한 별칭
export const KOREA_AIRPORTS: Record<string, { name: string; type: string }> = Object.fromEntries(
  Object.entries(AIRPORT_DATABASE)
    .filter(([, info]) => info.country === 'KR')
    .map(([code, info]) => [code, {
      name: info.name,
      type: info.type === 'hub' ? 'international' : info.type === 'general' ? 'domestic' : info.type
    }])
);

/**
 * 공항 정보 조회
 */
export const getAirportInfo = (icao: string): DetailedAirportInfo | null => {
  const info = AIRPORT_DATABASE[icao];
  if (!info) return null;

  const country = COUNTRY_INFO[info.country];
  return {
    ...info,
    icao,
    countryName: country?.name || info.country,
    flag: country?.flag || '',
    typeLabel: AIRPORT_TYPE_LABELS[info.type] || info.type,
    coordinates: AIRPORT_COORDINATES[icao] || null,
  };
};

/**
 * 공항 이름 조회
 */
export const getAirportName = (icao: string): string => {
  return AIRPORT_DATABASE[icao]?.name || icao;
};

/**
 * 공항 좌표 조회
 */
export const getAirportCoordinates = (icao: string): AirportCoordinate | null => {
  return AIRPORT_COORDINATES[icao] || null;
};
