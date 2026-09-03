/**
 * Country centroid coordinates, keyed by ISO-3166-1 alpha-2 code.
 *
 * PORTED VERBATIM from the app's `utils/CountryLatLngProvider.kt` (247 entries) and
 * GENERATED — do not hand-edit an entry. A wrong centroid fails silently: the farmer simply gets
 * advice for the wrong place. Regenerate from the app source if it changes.
 *
 * This is the app's fallback when the IP-geolocation call (Google `geolocate`) fails. An unknown
 * country code yields (0, 0), which callers MUST treat as "no location", never as a real one.
 */
export const COUNTRY_LAT_LNG: Record<string, [number, number]> = {
  AD: [42.546245, 1.601554],  // Andorra
  AE: [23.424076, 53.847818],  // United Arab Emirates
  AF: [33.93911, 67.709953],  // Afghanistan
  AG: [17.060816, -61.796428],  // Antigua and Barbuda
  AI: [18.220554, -63.068615],  // Anguilla
  AL: [41.153332, 20.168331],  // Albania
  AM: [40.069099, 45.038189],  // Armenia
  AO: [-11.202692, 17.873887],  // Angola
  AQ: [-75.250973, -0.071389],  // Antarctica
  AR: [-38.416097, -63.616672],  // Argentina
  AS: [-14.270972, -170.132217],  // American Samoa
  AT: [47.516231, 14.550072],  // Austria
  AU: [-25.274398, 133.775136],  // Australia
  AW: [12.52111, -69.968338],  // Aruba
  AX: [60.198, 19.952],  // Åland Islands
  AZ: [40.143105, 47.576927],  // Azerbaijan
  BA: [43.915886, 17.679076],  // Bosnia and Herzegovina
  BB: [13.193887, -59.543198],  // Barbados
  BD: [23.684994, 90.356331],  // Bangladesh
  BE: [50.503887, 4.469936],  // Belgium
  BF: [12.238333, -1.561593],  // Burkina Faso
  BG: [42.733883, 25.48583],  // Bulgaria
  BH: [26.0667, 50.5577],  // Bahrain
  BI: [-3.373056, 29.918886],  // Burundi
  BJ: [9.30769, 2.315834],  // Benin
  BL: [17.896438, -62.852201],  // Saint Barthélemy
  BM: [32.321384, -64.75737],  // Bermuda
  BN: [4.535277, 114.727669],  // Brunei
  BO: [-16.290154, -63.588653],  // Bolivia
  BQ: [12.20189, -68.262743],  // Caribbean Netherlands
  BR: [-14.235004, -51.92528],  // Brazil
  BS: [25.03428, -77.39628],  // Bahamas
  BT: [27.514162, 90.433601],  // Bhutan
  BW: [-22.328474, 24.684866],  // Botswana
  BY: [53.709807, 27.953389],  // Belarus
  BZ: [17.189877, -88.49765],  // Belize
  CA: [60.0000, -95.0000],  // Canada (Verified Geographic Center)
  CC: [-12.164165, 96.870956],  // Cocos (Keeling) Islands
  CD: [-4.038333, 21.758664],  // DR Congo
  CF: [6.611111, 20.939444],  // Central African Republic
  CG: [-0.228021, 15.827659],  // Republic of the Congo
  CH: [46.818188, 8.227512],  // Switzerland
  CI: [7.539989, -5.54708],  // Ivory Coast
  CK: [-21.236736, -159.777671],  // Cook Islands
  CL: [-35.675147, -71.542969],  // Chile
  CM: [7.369722, 12.354722],  // Cameroon
  CN: [35.0000, 105.0000],  // China (Verified Center)
  CO: [4.570868, -74.297333],  // Colombia
  CR: [9.748917, -83.753428],  // Costa Rica
  CU: [21.521757, -77.781167],  // Cuba
  CV: [16.002082, -24.013197],  // Cape Verde
  CW: [12.169575, -68.99002],  // Curaçao
  CX: [-10.447525, 105.690449],  // Christmas Island
  CY: [35.126413, 33.429859],  // Cyprus
  CZ: [49.817491, 15.472962],  // Czech Republic
  DE: [51.165691, 10.451526],  // Germany
  DJ: [11.825138, 42.590275],  // Djibouti
  DK: [56.26392, 9.501785],  // Denmark
  DM: [15.414999, -61.370976],  // Dominica
  DO: [18.735693, -70.162651],  // Dominican Republic
  DZ: [28.033886, 1.659626],  // Algeria
  EC: [-1.831239, -78.183406],  // Ecuador
  EE: [58.595272, 25.013607],  // Estonia
  EG: [26.820553, 30.802498],  // Egypt
  EH: [24.215527, -12.885834],  // Western Sahara
  ER: [15.179384, 39.782334],  // Eritrea
  ES: [40.463667, -3.74922],  // Spain
  ET: [9.145, 40.489673],  // Ethiopia
  EU: [54.526, 15.2551],  // European Union
  FI: [61.92411, 25.748151],  // Finland
  FJ: [-16.578193, 179.414413],  // Fiji
  FK: [-51.796253, -59.523613],  // Falkland Islands
  FM: [7.425554, 150.550812],  // Micronesia
  FO: [61.892635, -6.911806],  // Faroe Islands
  FR: [46.227638, 2.213749],  // France
  GA: [-0.803689, 11.609444],  // Gabon
  GB: [55.378051, -3.435973],  // United Kingdom
  GD: [12.262776, -61.604171],  // Grenada
  GE: [42.315407, 43.356892],  // Georgia
  GF: [3.933889, -53.125782],  // French Guiana
  GG: [49.465691, -2.585278],  // Guernsey
  GH: [7.946527, -1.023194],  // Ghana
  GI: [36.137741, -5.345374],  // Gibraltar
  GL: [71.706936, -42.604303],  // Greenland
  GM: [13.443182, -15.310139],  // Gambia
  GN: [9.945587, -9.696645],  // Guinea
  GP: [16.995971, -62.067641],  // Guadeloupe
  GQ: [1.650801, 10.267895],  // Equatorial Guinea
  GR: [39.074208, 21.824312],  // Greece
  GS: [-54.429579, -36.587909],  // South Georgia
  GT: [15.783471, -90.230759],  // Guatemala
  GU: [13.444304, 144.793731],  // Guam
  GW: [11.803749, -15.180413],  // Guinea-Bissau
  GY: [4.860416, -58.93018],  // Guyana
  HK: [22.396429, 114.109497],  // Hong Kong
  HN: [15.199999, -86.241905],  // Honduras
  HR: [45.1, 15.2],  // Croatia
  HT: [18.971187, -72.285215],  // Haiti
  HU: [47.162494, 19.503304],  // Hungary
  ID: [-0.789275, 113.921327],  // Indonesia
  IE: [53.41291, -8.24389],  // Ireland
  IL: [31.046051, 34.851612],  // Israel
  IM: [54.236107, -4.548056],  // Isle of Man
  IN: [20.593684, 78.96288],  // India (Center near Nagpur)
  IO: [-6.343194, 71.876519],  // British Indian Ocean Territory
  IQ: [33.223191, 43.679291],  // Iraq
  IR: [32.0000, 53.0000],  // Iran (Verified Center)
  IS: [64.963051, -19.020835],  // Iceland
  IT: [41.87194, 12.56738],  // Italy
  JE: [49.214439, -2.13125],  // Jersey
  JM: [18.109581, -77.297508],  // Jamaica
  JO: [30.585164, 36.238414],  // Jordan
  JP: [36.0000, 138.0000],  // Japan (Verified Center)
  KE: [-0.023559, 37.906193],  // Kenya
  KG: [41.20438, 74.766098],  // Kyrgyzstan
  KH: [12.565679, 104.990963],  // Cambodia
  KI: [-3.370417, -168.734039],  // Kiribati
  KM: [-11.6455, 43.3333],  // Comoros
  KN: [17.357822, -62.782998],  // Saint Kitts and Nevis
  KP: [40.339852, 127.510093],  // North Korea
  KR: [35.907757, 127.766922],  // South Korea
  KW: [29.31166, 47.481766],  // Kuwait
  KY: [19.513469, -80.566956],  // Cayman Islands
  KZ: [48.019573, 66.923684],  // Kazakhstan
  LA: [19.85627, 102.495496],  // Laos
  LB: [33.854721, 35.862285],  // Lebanon
  LC: [13.909444, -60.978893],  // Saint Lucia
  LI: [47.166, 9.555373],  // Liechtenstein
  LK: [7.873054, 80.771797],  // Sri Lanka
  LR: [6.428055, -9.429499],  // Liberia
  LS: [-29.609988, 28.233608],  // Lesotho
  LT: [55.169438, 23.881275],  // Lithuania
  LU: [49.815273, 6.129583],  // Luxembourg
  LV: [56.879635, 24.603189],  // Latvia
  LY: [26.3351, 17.228331],  // Libya
  MA: [31.791702, -7.09262],  // Morocco
  MC: [43.738418, 7.424616],  // Monaco
  MD: [47.411631, 28.369885],  // Moldova
  ME: [42.708678, 19.37439],  // Montenegro
  MF: [18.07083, -63.050081],  // Saint Martin
  MG: [-18.766947, 46.869107],  // Madagascar
  MH: [7.131474, 171.184478],  // Marshall Islands
  MK: [41.608635, 21.745275],  // North Macedonia
  ML: [17.570692, -3.996166],  // Mali
  MM: [21.913965, 95.956017],  // Myanmar
  MN: [46.862496, 103.846656],  // Mongolia
  MO: [22.198745, 113.543873],  // Macau
  MP: [14.861242, 145.548265],  // Northern Mariana Islands
  MQ: [14.641528, -61.024174],  // Martinique
  MR: [21.00789, -10.940835],  // Mauritania
  MS: [16.742498, -62.187366],  // Montserrat
  MT: [35.937496, 14.375416],  // Malta
  MU: [-20.348404, 57.552152],  // Mauritius
  MV: [3.202778, 73.22068],  // Maldives
  MW: [-13.254308, 34.301525],  // Malawi
  MX: [23.634501, -102.552784],  // Mexico
  MY: [4.210484, 101.975766],  // Malaysia
  MZ: [-18.665695, 35.529562],  // Mozambique
  NA: [-22.95764, 18.49041],  // Namibia
  NC: [-20.904305, 165.618042],  // New Caledonia
  NE: [17.607789, 8.081666],  // Niger
  NF: [-29.040835, 167.954712],  // Norfolk Island
  NG: [9.081999, 8.675277],  // Nigeria
  NI: [12.865416, -85.207229],  // Nicaragua
  NL: [52.132633, 5.291266],  // Netherlands
  NO: [60.472024, 8.468946],  // Norway
  NP: [28.394857, 84.124008],  // Nepal
  NR: [-0.522778, 166.931503],  // Nauru
  NU: [-19.054445, -169.867233],  // Niue
  NZ: [-40.900557, 174.885971],  // New Zealand
  OM: [21.473533, 55.975413],  // Oman
  PA: [8.537981, -80.782127],  // Panama
  PE: [-9.189967, -75.015152],  // Peru
  PF: [-17.679742, -149.406843],  // French Polynesia
  PG: [-6.314993, 143.95555],  // Papua New Guinea
  PH: [12.879721, 121.774017],  // Philippines
  PK: [30.375321, 69.345116],  // Pakistan
  PL: [51.919438, 19.145136],  // Poland
  PM: [46.941936, -56.27111],  // Saint Pierre and Miquelon
  PN: [-24.703615, -127.439308],  // Pitcairn Islands
  PR: [18.220833, -66.590149],  // Puerto Rico
  PS: [31.952162, 35.233154],  // Palestine
  PT: [39.399872, -8.224454],  // Portugal
  PW: [7.51498, 134.58252],  // Palau
  PY: [-23.442503, -58.443832],  // Paraguay
  QA: [25.354826, 51.183884],  // Qatar
  RE: [-21.115141, 55.536384],  // Réunion
  RO: [45.943161, 24.96676],  // Romania
  RS: [44.016521, 21.005859],  // Serbia
  RU: [60.0000, 100.0000],  // Russia (Verified Center)
  RW: [-1.940278, 29.873888],  // Rwanda
  SA: [25.0000, 45.0000],  // Saudi Arabia (Verified Center)
  SB: [-9.64571, 160.156194],  // Solomon Islands
  SC: [-4.679574, 55.491977],  // Seychelles
  SD: [15.0000, 30.0000],  // Sudan (Verified Center)
  SE: [62.0000, 15.0000],  // Sweden (Verified Center)
  SG: [1.352083, 103.819836],  // Singapore
  SH: [-15.9650, -5.7089],  // Saint Helena (Verified Center)
  SI: [46.151241, 14.995463],  // Slovenia
  SJ: [77.553604, 23.670272],  // Svalbard and Jan Mayen
  SK: [48.669026, 19.699024],  // Slovakia
  SL: [8.460555, -11.779889],  // Sierra Leone
  SM: [43.94236, 12.457777],  // San Marino
  SN: [14.0000, -14.0000],  // Senegal (Verified Center)
  SO: [10.0000, 49.0000],  // Somalia (Verified Center)
  SR: [4.0000, -56.0000],  // Suriname (Verified Center)
  SS: [8.0000, 30.0000],  // South Sudan (Verified Center)
  ST: [1.0000, 7.0000],  // São Tomé and Príncipe
  SV: [13.8333, -88.9167],  // El Salvador
  SX: [18.04248, -63.05483],  // Sint Maarten
  SY: [35.0000, 38.0000],  // Syria (Verified Center)
  SZ: [-26.5000, 31.5000],  // Eswatini
  TC: [21.7500, -71.7500],  // Turks and Caicos Islands
  TD: [15.0000, 19.0000],  // Chad (Verified Center)
  TF: [-49.2500, 69.1670],  // French Southern Territories (Kerguelen)
  TG: [8.0000, 1.1667],  // Togo
  TH: [15.0000, 100.0000],  // Thailand (Verified Center)
  TJ: [39.0000, 71.0000],  // Tajikistan
  TK: [-9.0000, -172.0000],  // Tokelau
  TL: [-8.8333, 125.9167],  // Timor-Leste
  TM: [40.0000, 60.0000],  // Turkmenistan
  TN: [34.0000, 9.0000],  // Tunisia (Verified Center)
  TO: [-20.0000, -175.0000],  // Tonga
  TR: [39.0000, 35.0000],  // Turkey (Verified Center)
  TT: [11.0000, -61.0000],  // Trinidad and Tobago
  TV: [-8.0000, 178.0000],  // Tuvalu
  TW: [23.5000, 121.0000],  // Taiwan
  TZ: [-6.0000, 35.0000],  // Tanzania (Verified Center)
  UA: [49.0000, 32.0000],  // Ukraine (Verified Center)
  UG: [1.0000, 32.0000],  // Uganda
  US: [44.9672, -103.7715],  // United States (Geographic Center, SD)
  UY: [-33.0000, -56.0000],  // Uruguay
  UZ: [41.0000, 64.0000],  // Uzbekistan
  VA: [41.9029, 12.4534],  // Vatican City
  VC: [13.2500, -61.2000],  // St. Vincent and Grenadines
  VE: [8.0000, -66.0000],  // Venezuela (Verified Center)
  VG: [18.5000, -64.5000],  // British Virgin Islands
  VI: [18.3333, -64.8333],  // US Virgin Islands
  VN: [16.0000, 106.0000],  // Vietnam (Verified Center)
  VU: [-16.0000, 167.0000],  // Vanuatu
  WF: [-13.3000, -176.2000],  // Wallis and Futuna
  WS: [-13.5833, -172.3333],  // Samoa
  YE: [15.0000, 48.0000],  // Yemen (Verified Center)
  YT: [-12.8333, 45.1667],  // Mayotte
  ZA: [-29.0000, 24.0000],  // South Africa (Verified Center)
  ZM: [-15.0000, 30.0000],  // Zambia (Verified Center)
  ZW: [-20.0000, 30.0000]  // Zimbabwe (Verified Center)
};

/** Centroid for `countryCode`; [0, 0] when the country is unknown. */
export function getLatLng(countryCode: string): [number, number] {
  return COUNTRY_LAT_LNG[countryCode] ?? [0, 0];
}

/** True when a resolved pair is usable — the app's `lat != 0.0 && lng != 0.0` guard. */
export function isResolved(lat: number, lng: number): boolean {
  return lat !== 0 && lng !== 0;
}

/** Uppercase ISO-3166 region subtag from a BCP-47 tag, or "" when the tag carries no region. */
export function regionFromLocaleTag(tag: string | null | undefined): string {
  if (!tag) return '';
  // en-IN -> IN, en-Latn-IN -> IN, en -> "" (a language alone is NOT a country).
  const parts = String(tag).replace(/_/g, '-').split('-');
  for (const part of parts.slice(1)) {
    if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
  }
  return '';
}

/**
 * The browser locale's region and its centroid — the app's `getLatLngFromDeviceLocale`.
 *
 * A browser language such as plain `en` carries NO region, so this returns "" and [0, 0]; the
 * caller must treat that as "no location resolved" rather than guessing a country.
 */
export function fromDeviceLocale(): { countryCode: string; lat: number; lng: number } {
  let tag = '';
  try {
    tag = Intl.DateTimeFormat().resolvedOptions().locale || '';
  } catch {
    tag = '';
  }
  if (!regionFromLocaleTag(tag) && typeof navigator !== 'undefined') {
    tag = navigator.language || (navigator.languages && navigator.languages[0]) || tag;
  }
  const countryCode = regionFromLocaleTag(tag);
  const [lat, lng] = getLatLng(countryCode);
  return { countryCode, lat, lng };
}
