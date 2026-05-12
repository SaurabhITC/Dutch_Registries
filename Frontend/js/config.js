// Module-level configuration constants for the dashboard frontend.
// Pure data only — no DOM references, no functions, no side effects.

export const DEFAULT_VIEW = { center: [5.3, 52.1], zoom: 6.5, bearing: 0, pitch: 0 };
export const NL_BOUNDS = [[3.31, 50.75], [7.23, 53.55]];
export const NL_FIT_PADDING = { top: 40, bottom: 40, left: 40, right: 60 };
export const BACKEND_BASE_URL = "";

export const PDOK_STYLE_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/styles/bestuurlijkegebieden_standaardvisualisatie__webmercatorquad?f=json";
export const LAND_FEATURES_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/landgebied/items?f=json&limit=10";
export const BRT_TILES = "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png";
export const LUCHTFOTO_WMTS_CAPS = "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0?request=GetCapabilities&service=WMTS";
export const WORLD_TOPO = "/vendor/countries-50m.json";

export const BAG_COLLECTIONS = {
  pand: {
    label: { nl:"Pand", en:"Building" },
    popupTitle: { nl:"BAG pand", en:"BAG building" },
    geometry: "polygon",
    fill: "#d9c4a6",
    line: "#8b5e3c",
    fillOpacity: 0.42
  },
  verblijfsobject: {
    label: { nl:"Verblijfsobject", en:"Residential unit" },
    popupTitle: { nl:"BAG verblijfsobject", en:"BAG residential unit" },
    geometry: "point",
    circle: "#0ea5e9",
    radius: 4.8
  },
  adres: {
    label: { nl:"Adres", en:"Address" },
    popupTitle: { nl:"BAG adres", en:"BAG address" },
    geometry: "point",
    circle: "#f97316",
    radius: 4.2
  },
  woonplaats: {
    label: { nl:"Woonplaats", en:"Place" },
    popupTitle: { nl:"BAG woonplaats", en:"BAG place" },
    geometry: "polygon",
    fill: "#bbf7d0",
    line: "#16a34a",
    fillOpacity: 0.10
  },
  standplaats: {
    label: { nl:"Standplaats", en:"Standplace" },
    popupTitle: { nl:"BAG standplaats", en:"BAG standplace" },
    geometry: "polygon",
    fill: "#fde68a",
    line: "#d97706",
    fillOpacity: 0.34
  },
  ligplaats: {
    label: { nl:"Ligplaats", en:"Mooring place" },
    popupTitle: { nl:"BAG ligplaats", en:"BAG mooring place" },
    geometry: "polygon",
    fill: "#c7d2fe",
    line: "#4f46e5",
    fillOpacity: 0.34
  }
};
export const ALL_BAG_KEYS = Object.keys(BAG_COLLECTIONS);

export const AUTO_RETRY_DELAYS_MS = [1500, 4000, 8000];
export const BAG_FETCH_CONCURRENCY = 3;

export const BOUWJAAR_BUCKETS = [
  { label: '<1900',     min: -Infinity, max: 1899 },
  { label: '1900-1909', min: 1900,      max: 1909 },
  { label: '1910-1919', min: 1910,      max: 1919 },
  { label: '1920-1929', min: 1920,      max: 1929 },
  { label: '1930-1939', min: 1930,      max: 1939 },
  { label: '1940-1949', min: 1940,      max: 1949 },
  { label: '1950-1959', min: 1950,      max: 1959 },
  { label: '1960-1969', min: 1960,      max: 1969 },
  { label: '1970-1979', min: 1970,      max: 1979 },
  { label: '1980-1989', min: 1980,      max: 1989 },
  { label: '1990-1999', min: 1990,      max: 1999 },
  { label: '2000-2009', min: 2000,      max: 2009 },
  { label: '2010-2019', min: 2010,      max: 2019 },
  { label: '2020+',     min: 2020,      max: Infinity },
];

// 14-stop spectral ramp for the bouwjaar CHART (one color per decade bin).
// Aligned to BOUWJAAR_BUCKETS order: index 0 = <1900 (oldest, dark red)
// through index 13 = 2020+ (newest, deep purple). The MAP uses
// BOUWJAAR_MAP_COLORS below — same spectral arc but with the pale middle
// sharpened for visibility against the basemap.
export const BOUWJAAR_CHART_COLORS = [
  '#67001f', // <1900       — oldest, dark red
  '#a50026', // 1900-1909
  '#d73027', // 1910-1919
  '#f46d43', // 1920-1929
  '#fdae61', // 1930-1939
  '#fee090', // 1940-1949
  '#ffffbf', // 1950-1959   — neutral / mid-century
  '#e0f3f8', // 1960-1969
  '#abd9e9', // 1970-1979
  '#74add1', // 1980-1989
  '#4575b4', // 1990-1999
  '#313695', // 2000-2009
  '#5e4fa2', // 2010-2019
  '#3f007d', // 2020+       — newest, deep purple
];

// 14-stop spectral ramp for the bouwjaar MAP layer. Same spectral arc
// as BOUWJAAR_CHART_COLORS (chart) but with the pale 1940s-1960s middle
// colors sharpened so every decade is visible against the BRT basemap.
// Chart and map both follow BOUWJAAR_BUCKETS order: index 0 = <1900,
// index 13 = 2020+. Adjacent indices stay in the same hue family
// (e.g. 1970-79 and 1980-89 both light/medium blue) so a user
// comparing map and chart can still match decade-to-decade.
export const BOUWJAAR_MAP_COLORS = [
  '#67001f', // <1900       — oldest, dark red    (same as chart)
  '#a50026', // 1900-1909   — dark red            (same)
  '#d73027', // 1910-1919   — red                 (same)
  '#f46d43', // 1920-1929   — orange-red          (same)
  '#fdae61', // 1930-1939   — orange              (same)
  '#fed976', // 1940-1949   — sharper yellow      (was #fee090)
  '#feb24c', // 1950-1959   — amber               (was #ffffbf — too pale)
  '#9ecae1', // 1960-1969   — light blue          (was #e0f3f8 — too pale)
  '#6baed6', // 1970-1979   — medium light blue   (was #abd9e9)
  '#3182bd', // 1980-1989   — medium blue         (was #74add1)
  '#08519c', // 1990-1999   — dark blue           (was #4575b4)
  '#54278f', // 2000-2009   — purple              (was #313695)
  '#3f007d', // 2010-2019   — deep purple         (was #5e4fa2)
  '#1e0040', // 2020+       — darkest purple      (was #3f007d)
];

export const OPPERVLAKTE_BUCKETS = [
  { label: '<50 m²',     min: -Infinity, lt: 50 },
  { label: '50-75 m²',   min: 50,        lt: 75 },
  { label: '75-100 m²',  min: 75,        lt: 100 },
  { label: '100-150 m²', min: 100,       lt: 150 },
  { label: '150-250 m²', min: 150,       lt: 250 },
  { label: '250+ m²',    min: 250,       lt: Infinity },
];

export const GEBRUIKSDOEL_CATEGORIES = [
  'woonfunctie',
  'winkelfunctie',
  'kantoorfunctie',
  'industriefunctie',
  'onderwijsfunctie',
  'gezondheidszorgfunctie',
  'sportfunctie',
  'logiesfunctie',
  'bijeenkomstfunctie',
  'celfunctie',
  'overige gebruiksfunctie',
];

// BAG pandstatus values from the kadaster registry, grouped into three
// buckets for filtering. The exact strings here MUST match what PDOK
// returns in the 'status' property of pand features — they are used in
// the MapLibre filter expression directly. The 'unknown' bucket is for
// any future status values we haven't catalogued; we treat unknown as
// in_use so unfamiliar data isn't silently hidden.
export const PAND_STATUS_BUCKETS = {
  in_use: [
    'Pand in gebruik',
    'Pand in gebruik (niet ingemeten)',
    'Verbouwing pand',
    'Pand buiten gebruik',
  ],
  in_progress: [
    'Bouwvergunning verleend',
    'Bouw gestart',
    'Pand in aanbouw',
    'Sloopvergunning verleend',
  ],
  gone: [
    'Pand gesloopt',
    'Niet gerealiseerd pand',
    'Pand ten onrechte opgevoerd',
  ],
};

// Flat list of all known statuses, for quickly identifying "unknown".
export const PAND_KNOWN_STATUSES = [
  ...PAND_STATUS_BUCKETS.in_use,
  ...PAND_STATUS_BUCKETS.in_progress,
  ...PAND_STATUS_BUCKETS.gone,
];

// BAG status vocabulary for standplaats AND ligplaats — both object
// types use the same field values. Two buckets: 'live' (designated /
// issued, default visible) and 'gone' (withdrawn / never realized /
// registered in error, default hidden). No "in progress" bucket
// because these objects don't have construction phases.
export const PLAATS_STATUS_BUCKETS = {
  live: [
    'Plaats aangewezen',
    'Plaats uitgegeven',
  ],
  gone: [
    'Niet gerealiseerde plaats',
    'Plaats ingetrokken',
    'Plaats ten onrechte opgevoerd',
  ],
};

export const PLAATS_KNOWN_STATUSES = [
  ...PLAATS_STATUS_BUCKETS.live,
  ...PLAATS_STATUS_BUCKETS.gone,
];
