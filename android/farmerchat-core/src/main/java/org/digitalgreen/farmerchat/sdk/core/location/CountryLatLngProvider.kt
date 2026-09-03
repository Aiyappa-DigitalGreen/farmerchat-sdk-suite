package org.digitalgreen.farmerchat.sdk.core.location

import android.content.Context
import android.os.Build
import java.util.Locale

/**
 * Country centroid coordinates, keyed by ISO-3166-1 alpha-2 code.
 *
 * PORTED VERBATIM from the app's `utils/CountryLatLngProvider.kt` (247 entries) and GENERATED — do
 * not hand-edit an entry. A wrong centroid fails silently: the farmer simply gets advice for the
 * wrong place. Regenerate from the app source if it changes.
 *
 * This is the app's fallback when the IP-geolocation call (Google `geolocate`) fails. An unknown
 * country code yields (0.0, 0.0), which callers MUST treat as "no location", never as a real one.
 */
internal object CountryLatLngProvider {

    private val countryLatLngMap: Map<String, Pair<Double, Double>> by lazy {
        mapOf(
            "AD" to Pair(42.546245, 1.601554),  // Andorra
            "AE" to Pair(23.424076, 53.847818),  // United Arab Emirates
            "AF" to Pair(33.93911, 67.709953),  // Afghanistan
            "AG" to Pair(17.060816, -61.796428),  // Antigua and Barbuda
            "AI" to Pair(18.220554, -63.068615),  // Anguilla
            "AL" to Pair(41.153332, 20.168331),  // Albania
            "AM" to Pair(40.069099, 45.038189),  // Armenia
            "AO" to Pair(-11.202692, 17.873887),  // Angola
            "AQ" to Pair(-75.250973, -0.071389),  // Antarctica
            "AR" to Pair(-38.416097, -63.616672),  // Argentina
            "AS" to Pair(-14.270972, -170.132217),  // American Samoa
            "AT" to Pair(47.516231, 14.550072),  // Austria
            "AU" to Pair(-25.274398, 133.775136),  // Australia
            "AW" to Pair(12.52111, -69.968338),  // Aruba
            "AX" to Pair(60.198, 19.952),  // Åland Islands
            "AZ" to Pair(40.143105, 47.576927),  // Azerbaijan
            "BA" to Pair(43.915886, 17.679076),  // Bosnia and Herzegovina
            "BB" to Pair(13.193887, -59.543198),  // Barbados
            "BD" to Pair(23.684994, 90.356331),  // Bangladesh
            "BE" to Pair(50.503887, 4.469936),  // Belgium
            "BF" to Pair(12.238333, -1.561593),  // Burkina Faso
            "BG" to Pair(42.733883, 25.48583),  // Bulgaria
            "BH" to Pair(26.0667, 50.5577),  // Bahrain
            "BI" to Pair(-3.373056, 29.918886),  // Burundi
            "BJ" to Pair(9.30769, 2.315834),  // Benin
            "BL" to Pair(17.896438, -62.852201),  // Saint Barthélemy
            "BM" to Pair(32.321384, -64.75737),  // Bermuda
            "BN" to Pair(4.535277, 114.727669),  // Brunei
            "BO" to Pair(-16.290154, -63.588653),  // Bolivia
            "BQ" to Pair(12.20189, -68.262743),  // Caribbean Netherlands
            "BR" to Pair(-14.235004, -51.92528),  // Brazil
            "BS" to Pair(25.03428, -77.39628),  // Bahamas
            "BT" to Pair(27.514162, 90.433601),  // Bhutan
            "BW" to Pair(-22.328474, 24.684866),  // Botswana
            "BY" to Pair(53.709807, 27.953389),  // Belarus
            "BZ" to Pair(17.189877, -88.49765),  // Belize
            "CA" to Pair(60.0000, -95.0000),  // Canada (Verified Geographic Center)
            "CC" to Pair(-12.164165, 96.870956),  // Cocos (Keeling) Islands
            "CD" to Pair(-4.038333, 21.758664),  // DR Congo
            "CF" to Pair(6.611111, 20.939444),  // Central African Republic
            "CG" to Pair(-0.228021, 15.827659),  // Republic of the Congo
            "CH" to Pair(46.818188, 8.227512),  // Switzerland
            "CI" to Pair(7.539989, -5.54708),  // Ivory Coast
            "CK" to Pair(-21.236736, -159.777671),  // Cook Islands
            "CL" to Pair(-35.675147, -71.542969),  // Chile
            "CM" to Pair(7.369722, 12.354722),  // Cameroon
            "CN" to Pair(35.0000, 105.0000),  // China (Verified Center)
            "CO" to Pair(4.570868, -74.297333),  // Colombia
            "CR" to Pair(9.748917, -83.753428),  // Costa Rica
            "CU" to Pair(21.521757, -77.781167),  // Cuba
            "CV" to Pair(16.002082, -24.013197),  // Cape Verde
            "CW" to Pair(12.169575, -68.99002),  // Curaçao
            "CX" to Pair(-10.447525, 105.690449),  // Christmas Island
            "CY" to Pair(35.126413, 33.429859),  // Cyprus
            "CZ" to Pair(49.817491, 15.472962),  // Czech Republic
            "DE" to Pair(51.165691, 10.451526),  // Germany
            "DJ" to Pair(11.825138, 42.590275),  // Djibouti
            "DK" to Pair(56.26392, 9.501785),  // Denmark
            "DM" to Pair(15.414999, -61.370976),  // Dominica
            "DO" to Pair(18.735693, -70.162651),  // Dominican Republic
            "DZ" to Pair(28.033886, 1.659626),  // Algeria
            "EC" to Pair(-1.831239, -78.183406),  // Ecuador
            "EE" to Pair(58.595272, 25.013607),  // Estonia
            "EG" to Pair(26.820553, 30.802498),  // Egypt
            "EH" to Pair(24.215527, -12.885834),  // Western Sahara
            "ER" to Pair(15.179384, 39.782334),  // Eritrea
            "ES" to Pair(40.463667, -3.74922),  // Spain
            "ET" to Pair(9.145, 40.489673),  // Ethiopia
            "EU" to Pair(54.526, 15.2551),  // European Union
            "FI" to Pair(61.92411, 25.748151),  // Finland
            "FJ" to Pair(-16.578193, 179.414413),  // Fiji
            "FK" to Pair(-51.796253, -59.523613),  // Falkland Islands
            "FM" to Pair(7.425554, 150.550812),  // Micronesia
            "FO" to Pair(61.892635, -6.911806),  // Faroe Islands
            "FR" to Pair(46.227638, 2.213749),  // France
            "GA" to Pair(-0.803689, 11.609444),  // Gabon
            "GB" to Pair(55.378051, -3.435973),  // United Kingdom
            "GD" to Pair(12.262776, -61.604171),  // Grenada
            "GE" to Pair(42.315407, 43.356892),  // Georgia
            "GF" to Pair(3.933889, -53.125782),  // French Guiana
            "GG" to Pair(49.465691, -2.585278),  // Guernsey
            "GH" to Pair(7.946527, -1.023194),  // Ghana
            "GI" to Pair(36.137741, -5.345374),  // Gibraltar
            "GL" to Pair(71.706936, -42.604303),  // Greenland
            "GM" to Pair(13.443182, -15.310139),  // Gambia
            "GN" to Pair(9.945587, -9.696645),  // Guinea
            "GP" to Pair(16.995971, -62.067641),  // Guadeloupe
            "GQ" to Pair(1.650801, 10.267895),  // Equatorial Guinea
            "GR" to Pair(39.074208, 21.824312),  // Greece
            "GS" to Pair(-54.429579, -36.587909),  // South Georgia
            "GT" to Pair(15.783471, -90.230759),  // Guatemala
            "GU" to Pair(13.444304, 144.793731),  // Guam
            "GW" to Pair(11.803749, -15.180413),  // Guinea-Bissau
            "GY" to Pair(4.860416, -58.93018),  // Guyana
            "HK" to Pair(22.396429, 114.109497),  // Hong Kong
            "HN" to Pair(15.199999, -86.241905),  // Honduras
            "HR" to Pair(45.1, 15.2),  // Croatia
            "HT" to Pair(18.971187, -72.285215),  // Haiti
            "HU" to Pair(47.162494, 19.503304),  // Hungary
            "ID" to Pair(-0.789275, 113.921327),  // Indonesia
            "IE" to Pair(53.41291, -8.24389),  // Ireland
            "IL" to Pair(31.046051, 34.851612),  // Israel
            "IM" to Pair(54.236107, -4.548056),  // Isle of Man
            "IN" to Pair(20.593684, 78.96288),  // India (Center near Nagpur)
            "IO" to Pair(-6.343194, 71.876519),  // British Indian Ocean Territory
            "IQ" to Pair(33.223191, 43.679291),  // Iraq
            "IR" to Pair(32.0000, 53.0000),  // Iran (Verified Center)
            "IS" to Pair(64.963051, -19.020835),  // Iceland
            "IT" to Pair(41.87194, 12.56738),  // Italy
            "JE" to Pair(49.214439, -2.13125),  // Jersey
            "JM" to Pair(18.109581, -77.297508),  // Jamaica
            "JO" to Pair(30.585164, 36.238414),  // Jordan
            "JP" to Pair(36.0000, 138.0000),  // Japan (Verified Center)
            "KE" to Pair(-0.023559, 37.906193),  // Kenya
            "KG" to Pair(41.20438, 74.766098),  // Kyrgyzstan
            "KH" to Pair(12.565679, 104.990963),  // Cambodia
            "KI" to Pair(-3.370417, -168.734039),  // Kiribati
            "KM" to Pair(-11.6455, 43.3333),  // Comoros
            "KN" to Pair(17.357822, -62.782998),  // Saint Kitts and Nevis
            "KP" to Pair(40.339852, 127.510093),  // North Korea
            "KR" to Pair(35.907757, 127.766922),  // South Korea
            "KW" to Pair(29.31166, 47.481766),  // Kuwait
            "KY" to Pair(19.513469, -80.566956),  // Cayman Islands
            "KZ" to Pair(48.019573, 66.923684),  // Kazakhstan
            "LA" to Pair(19.85627, 102.495496),  // Laos
            "LB" to Pair(33.854721, 35.862285),  // Lebanon
            "LC" to Pair(13.909444, -60.978893),  // Saint Lucia
            "LI" to Pair(47.166, 9.555373),  // Liechtenstein
            "LK" to Pair(7.873054, 80.771797),  // Sri Lanka
            "LR" to Pair(6.428055, -9.429499),  // Liberia
            "LS" to Pair(-29.609988, 28.233608),  // Lesotho
            "LT" to Pair(55.169438, 23.881275),  // Lithuania
            "LU" to Pair(49.815273, 6.129583),  // Luxembourg
            "LV" to Pair(56.879635, 24.603189),  // Latvia
            "LY" to Pair(26.3351, 17.228331),  // Libya
            "MA" to Pair(31.791702, -7.09262),  // Morocco
            "MC" to Pair(43.738418, 7.424616),  // Monaco
            "MD" to Pair(47.411631, 28.369885),  // Moldova
            "ME" to Pair(42.708678, 19.37439),  // Montenegro
            "MF" to Pair(18.07083, -63.050081),  // Saint Martin
            "MG" to Pair(-18.766947, 46.869107),  // Madagascar
            "MH" to Pair(7.131474, 171.184478),  // Marshall Islands
            "MK" to Pair(41.608635, 21.745275),  // North Macedonia
            "ML" to Pair(17.570692, -3.996166),  // Mali
            "MM" to Pair(21.913965, 95.956017),  // Myanmar
            "MN" to Pair(46.862496, 103.846656),  // Mongolia
            "MO" to Pair(22.198745, 113.543873),  // Macau
            "MP" to Pair(14.861242, 145.548265),  // Northern Mariana Islands
            "MQ" to Pair(14.641528, -61.024174),  // Martinique
            "MR" to Pair(21.00789, -10.940835),  // Mauritania
            "MS" to Pair(16.742498, -62.187366),  // Montserrat
            "MT" to Pair(35.937496, 14.375416),  // Malta
            "MU" to Pair(-20.348404, 57.552152),  // Mauritius
            "MV" to Pair(3.202778, 73.22068),  // Maldives
            "MW" to Pair(-13.254308, 34.301525),  // Malawi
            "MX" to Pair(23.634501, -102.552784),  // Mexico
            "MY" to Pair(4.210484, 101.975766),  // Malaysia
            "MZ" to Pair(-18.665695, 35.529562),  // Mozambique
            "NA" to Pair(-22.95764, 18.49041),  // Namibia
            "NC" to Pair(-20.904305, 165.618042),  // New Caledonia
            "NE" to Pair(17.607789, 8.081666),  // Niger
            "NF" to Pair(-29.040835, 167.954712),  // Norfolk Island
            "NG" to Pair(9.081999, 8.675277),  // Nigeria
            "NI" to Pair(12.865416, -85.207229),  // Nicaragua
            "NL" to Pair(52.132633, 5.291266),  // Netherlands
            "NO" to Pair(60.472024, 8.468946),  // Norway
            "NP" to Pair(28.394857, 84.124008),  // Nepal
            "NR" to Pair(-0.522778, 166.931503),  // Nauru
            "NU" to Pair(-19.054445, -169.867233),  // Niue
            "NZ" to Pair(-40.900557, 174.885971),  // New Zealand
            "OM" to Pair(21.473533, 55.975413),  // Oman
            "PA" to Pair(8.537981, -80.782127),  // Panama
            "PE" to Pair(-9.189967, -75.015152),  // Peru
            "PF" to Pair(-17.679742, -149.406843),  // French Polynesia
            "PG" to Pair(-6.314993, 143.95555),  // Papua New Guinea
            "PH" to Pair(12.879721, 121.774017),  // Philippines
            "PK" to Pair(30.375321, 69.345116),  // Pakistan
            "PL" to Pair(51.919438, 19.145136),  // Poland
            "PM" to Pair(46.941936, -56.27111),  // Saint Pierre and Miquelon
            "PN" to Pair(-24.703615, -127.439308),  // Pitcairn Islands
            "PR" to Pair(18.220833, -66.590149),  // Puerto Rico
            "PS" to Pair(31.952162, 35.233154),  // Palestine
            "PT" to Pair(39.399872, -8.224454),  // Portugal
            "PW" to Pair(7.51498, 134.58252),  // Palau
            "PY" to Pair(-23.442503, -58.443832),  // Paraguay
            "QA" to Pair(25.354826, 51.183884),  // Qatar
            "RE" to Pair(-21.115141, 55.536384),  // Réunion
            "RO" to Pair(45.943161, 24.96676),  // Romania
            "RS" to Pair(44.016521, 21.005859),  // Serbia
            "RU" to Pair(60.0000, 100.0000),  // Russia (Verified Center)
            "RW" to Pair(-1.940278, 29.873888),  // Rwanda
            "SA" to Pair(25.0000, 45.0000),  // Saudi Arabia (Verified Center)
            "SB" to Pair(-9.64571, 160.156194),  // Solomon Islands
            "SC" to Pair(-4.679574, 55.491977),  // Seychelles
            "SD" to Pair(15.0000, 30.0000),  // Sudan (Verified Center)
            "SE" to Pair(62.0000, 15.0000),  // Sweden (Verified Center)
            "SG" to Pair(1.352083, 103.819836),  // Singapore
            "SH" to Pair(-15.9650, -5.7089),  // Saint Helena (Verified Center)
            "SI" to Pair(46.151241, 14.995463),  // Slovenia
            "SJ" to Pair(77.553604, 23.670272),  // Svalbard and Jan Mayen
            "SK" to Pair(48.669026, 19.699024),  // Slovakia
            "SL" to Pair(8.460555, -11.779889),  // Sierra Leone
            "SM" to Pair(43.94236, 12.457777),  // San Marino
            "SN" to Pair(14.0000, -14.0000),  // Senegal (Verified Center)
            "SO" to Pair(10.0000, 49.0000),  // Somalia (Verified Center)
            "SR" to Pair(4.0000, -56.0000),  // Suriname (Verified Center)
            "SS" to Pair(8.0000, 30.0000),  // South Sudan (Verified Center)
            "ST" to Pair(1.0000, 7.0000),  // São Tomé and Príncipe
            "SV" to Pair(13.8333, -88.9167),  // El Salvador
            "SX" to Pair(18.04248, -63.05483),  // Sint Maarten
            "SY" to Pair(35.0000, 38.0000),  // Syria (Verified Center)
            "SZ" to Pair(-26.5000, 31.5000),  // Eswatini
            "TC" to Pair(21.7500, -71.7500),  // Turks and Caicos Islands
            "TD" to Pair(15.0000, 19.0000),  // Chad (Verified Center)
            "TF" to Pair(-49.2500, 69.1670),  // French Southern Territories (Kerguelen)
            "TG" to Pair(8.0000, 1.1667),  // Togo
            "TH" to Pair(15.0000, 100.0000),  // Thailand (Verified Center)
            "TJ" to Pair(39.0000, 71.0000),  // Tajikistan
            "TK" to Pair(-9.0000, -172.0000),  // Tokelau
            "TL" to Pair(-8.8333, 125.9167),  // Timor-Leste
            "TM" to Pair(40.0000, 60.0000),  // Turkmenistan
            "TN" to Pair(34.0000, 9.0000),  // Tunisia (Verified Center)
            "TO" to Pair(-20.0000, -175.0000),  // Tonga
            "TR" to Pair(39.0000, 35.0000),  // Turkey (Verified Center)
            "TT" to Pair(11.0000, -61.0000),  // Trinidad and Tobago
            "TV" to Pair(-8.0000, 178.0000),  // Tuvalu
            "TW" to Pair(23.5000, 121.0000),  // Taiwan
            "TZ" to Pair(-6.0000, 35.0000),  // Tanzania (Verified Center)
            "UA" to Pair(49.0000, 32.0000),  // Ukraine (Verified Center)
            "UG" to Pair(1.0000, 32.0000),  // Uganda
            "US" to Pair(44.9672, -103.7715),  // United States (Geographic Center, SD)
            "UY" to Pair(-33.0000, -56.0000),  // Uruguay
            "UZ" to Pair(41.0000, 64.0000),  // Uzbekistan
            "VA" to Pair(41.9029, 12.4534),  // Vatican City
            "VC" to Pair(13.2500, -61.2000),  // St. Vincent and Grenadines
            "VE" to Pair(8.0000, -66.0000),  // Venezuela (Verified Center)
            "VG" to Pair(18.5000, -64.5000),  // British Virgin Islands
            "VI" to Pair(18.3333, -64.8333),  // US Virgin Islands
            "VN" to Pair(16.0000, 106.0000),  // Vietnam (Verified Center)
            "VU" to Pair(-16.0000, 167.0000),  // Vanuatu
            "WF" to Pair(-13.3000, -176.2000),  // Wallis and Futuna
            "WS" to Pair(-13.5833, -172.3333),  // Samoa
            "YE" to Pair(15.0000, 48.0000),  // Yemen (Verified Center)
            "YT" to Pair(-12.8333, 45.1667),  // Mayotte
            "ZA" to Pair(-29.0000, 24.0000),  // South Africa (Verified Center)
            "ZM" to Pair(-15.0000, 30.0000),  // Zambia (Verified Center)
            "ZW" to Pair(-20.0000, 30.0000)  // Zimbabwe (Verified Center)
        )
    }

    /** Number of entries, asserted by tests so a hand-edit of the generated table is caught. */
    val entryCount: Int get() = countryLatLngMap.size

    /** Centroid for [countryCode]; (0.0, 0.0) when the country is unknown. */
    fun getLatLng(countryCode: String): Pair<Double, Double> =
        countryLatLngMap[countryCode] ?: Pair(0.0, 0.0)

    /**
     * The device locale's country and its centroid — the app's `getLatLngFromDeviceLocale`.
     *
     * Returns a blank country code and (0.0, 0.0) when the locale carries no region, which the
     * caller must treat as "no location resolved".
     */
    fun fromDeviceLocale(context: Context): Triple<String, Double, Double> {
        val configuration = context.resources.configuration
        val locale: Locale = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            configuration.locales.get(0) ?: Locale.getDefault()
        } else {
            @Suppress("DEPRECATION")
            configuration.locale ?: Locale.getDefault()
        }
        val countryCode = locale.country.orEmpty()
        val (lat, lng) = getLatLng(countryCode)
        return Triple(countryCode, lat, lng)
    }

    /** True when a resolved pair is usable — the app's `lat != 0.0 && lng != 0.0` guard. */
    fun isResolved(lat: Double, lng: Double): Boolean = lat != 0.0 && lng != 0.0
}
