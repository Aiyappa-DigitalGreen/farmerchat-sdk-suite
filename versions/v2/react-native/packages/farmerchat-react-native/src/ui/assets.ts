/**
 * Asset registry — PNGs rasterized from the app's vector drawables
 * (fc_logo_mark, fc_icon_*) plus the glow/weather rasters copied as-is.
 * Icon PNGs are black + alpha and recolored at runtime via Image tintColor.
 */
import logoMark from '../assets/fc_logo_mark.png';
// Share card (app ShareCard.kt footer): rasterized from the app's logo_wordmark / google_play vectors.
import logoWordmark from '../assets/fc_logo_wordmark.png';
import googlePlay from '../assets/fc_google_play.png';
import iconCamera from '../assets/fc_icon_camera.png';
import iconMic from '../assets/fc_icon_mic.png';
import iconKeyboard from '../assets/fc_icon_keyboard.png';
import iconSend from '../assets/fc_icon_send.png';
import iconArrowDown from '../assets/fc_icon_arrow_down.png';
import iconShare from '../assets/fc_icon_share.png';
import iconSave from '../assets/fc_icon_save.png';
import iconHome from '../assets/fc_icon_home.png';
import iconSettings from '../assets/fc_icon_settings.png';
import iconLanguage from '../assets/fc_icon_language.png';
import iconHelp from '../assets/fc_icon_help.png';
import iconCard from '../assets/fc_icon_card.png';
import iconInfo from '../assets/fc_icon_info.png';
// Material "history" (24dp, Icons.Filled.History path), replacing the lightbulb that the app's
// fc_icon_timer drawable actually draws; same pathData as the Android SDKs.
import iconHistory from '../assets/fc_icon_history.png';
import iconSms from '../assets/fc_icon_sms.png';
import iconWhatsapp from '../assets/fc_icon_whatsapp.png';
import iconModeDay from '../assets/fc_icon_mode_day.png';
import iconModeNight from '../assets/fc_icon_mode_night.png';
import iconModeAuto from '../assets/fc_icon_mode_auto.png';
import iconPersonalization from '../assets/fc_icon_personalization.png';
import iconMenu from '../assets/fc_icon_menu.png';
import iconChevronRight from '../assets/fc_icon_chevron_right.png';
import iconChevronDown from '../assets/fc_icon_chevron_down.png';
import iconClose from '../assets/fc_icon_close.png';
import iconBack from '../assets/fc_icon_back.png';
import iconCheck from '../assets/fc_icon_check.png';
import iconSearch from '../assets/fc_icon_search.png';
import iconRefresh from '../assets/fc_icon_refresh.png';
import iconPlay from '../assets/fc_icon_play.png';
import iconPause from '../assets/fc_icon_pause.png';
import iconTrash from '../assets/fc_icon_trash.png';
import iconGallery from '../assets/fc_icon_gallery.png';
import iconSpeaker from '../assets/fc_icon_speaker.png';
// Material Symbols outlined "lightbulb" (the Compose tip card's Icons.Outlined.Lightbulb),
// rasterized from the Android views flavour's fc_ic_lightbulb.xml path at 256px.
import iconLightbulb from '../assets/fc_icon_lightbulb.png';
import glowYellow from '../assets/fc_glow_yellow.png';
import glowGreen from '../assets/fc_glow_green.png';
import weatherSunClouds from '../assets/fc_weather_sunclouds.png';
import weatherSun from '../assets/fc_weather_sun.png';
import weatherRain from '../assets/fc_weather_rain.png';
// Country farmer illustration for the location Recovery sheet, copied from the Android core's
// `assets/{ke,et,ng,in}/farmer_looking_at_phone_square.webp` (itself copied from the app).
import farmerPhoneSquareKe from '../assets/ke/farmer_looking_at_phone_square.webp';
import farmerPhoneSquareEt from '../assets/et/farmer_looking_at_phone_square.webp';
import farmerPhoneSquareNg from '../assets/ng/farmer_looking_at_phone_square.webp';
import farmerPhoneSquareIn from '../assets/in/farmer_looking_at_phone_square.webp';
// Full-screen message illustrations (Android SDK CountryImageAssets, farmerchat-core assets).
import farmerCameraKe from '../assets/ke/farmer_looking_at_camera.webp';
import farmerCameraEt from '../assets/et/farmer_looking_at_camera.webp';
import farmerCameraNg from '../assets/ng/farmer_looking_at_camera.webp';
import farmerCameraIn from '../assets/in/farmer_looking_at_camera.webp';
import farmerSkyKe from '../assets/ke/farmer_looking_at_sky.webp';
import farmerSkyEt from '../assets/et/farmer_looking_at_sky.webp';
import farmerSkyNg from '../assets/ng/farmer_looking_at_sky.webp';
import farmerSkyIn from '../assets/in/farmer_looking_at_sky.webp';
import farmerPhoneKe from '../assets/ke/farmer_looking_at_phone.webp';
import farmerPhoneEt from '../assets/et/farmer_looking_at_phone.webp';
import farmerPhoneNg from '../assets/ng/farmer_looking_at_phone.webp';
import farmerPhoneIn from '../assets/in/farmer_looking_at_phone.webp';

export const Icons = {
  camera: iconCamera,
  mic: iconMic,
  keyboard: iconKeyboard,
  send: iconSend,
  arrowDown: iconArrowDown,
  share: iconShare,
  save: iconSave,
  home: iconHome,
  settings: iconSettings,
  language: iconLanguage,
  help: iconHelp,
  card: iconCard,
  info: iconInfo,
  history: iconHistory,
  sms: iconSms,
  whatsapp: iconWhatsapp,
  modeDay: iconModeDay,
  modeNight: iconModeNight,
  modeAuto: iconModeAuto,
  personalization: iconPersonalization,
  menu: iconMenu,
  chevronRight: iconChevronRight,
  chevronDown: iconChevronDown,
  close: iconClose,
  back: iconBack,
  check: iconCheck,
  search: iconSearch,
  refresh: iconRefresh,
  play: iconPlay,
  pause: iconPause,
  trash: iconTrash,
  gallery: iconGallery,
  speaker: iconSpeaker,
  lightbulb: iconLightbulb,
} as const;

export type IconName = keyof typeof Icons;

export const Assets = {
  logoMark,
  logoWordmark,
  googlePlay,
  glowYellow,
  glowGreen,
  weatherSunClouds,
  weatherSun,
  weatherRain,
} as const;

/**
 * Country-scoped farmer illustrations — port of the Android SDK's `CountryImageAssets`
 * (`ke` / `et` / `ng` / `in`, falling back to `ke` for any other or blank country code).
 *
 * All four `farmer_looking_at_*` images are bundled per country (the same files as the Android
 * SDK's `farmerchat-core/src/main/assets/<cc>/`).
 */
const FARMER_LOOKING_AT_PHONE_SQUARE: Record<string, number> = {
  ke: farmerPhoneSquareKe,
  et: farmerPhoneSquareEt,
  ng: farmerPhoneSquareNg,
  in: farmerPhoneSquareIn,
};

const FALLBACK_FARMER_COUNTRY = 'ke';

export function farmerLookingAtPhoneSquare(countryCode: string | null | undefined): number {
  const code = (countryCode ?? '').trim().toLowerCase();
  return (
    FARMER_LOOKING_AT_PHONE_SQUARE[code] ?? FARMER_LOOKING_AT_PHONE_SQUARE[FALLBACK_FARMER_COUNTRY]
  );
}

/** App `CountryImageAssets` names used by `FullScreenMessage`. */
export type FarmerIllustration = 'LOOKING_AT_CAMERA' | 'LOOKING_AT_SKY' | 'LOOKING_AT_PHONE';

const FARMER_ILLUSTRATIONS: Record<FarmerIllustration, Record<string, number>> = {
  LOOKING_AT_CAMERA: { ke: farmerCameraKe, et: farmerCameraEt, ng: farmerCameraNg, in: farmerCameraIn },
  LOOKING_AT_SKY: { ke: farmerSkyKe, et: farmerSkyEt, ng: farmerSkyNg, in: farmerSkyIn },
  LOOKING_AT_PHONE: { ke: farmerPhoneKe, et: farmerPhoneEt, ng: farmerPhoneNg, in: farmerPhoneIn },
};

/**
 * Android SDK `rememberCountryFarmerPainter` (compose util/Utils.kt:77-87): the stored
 * `USER_COUNTRY_CODE`, lower-cased; any other or blank code falls back to `ke`.
 */
export function countryFarmerIllustration(
  illustration: FarmerIllustration,
  countryCode: string | null | undefined,
): number {
  const set = FARMER_ILLUSTRATIONS[illustration];
  const code = (countryCode ?? '').trim().toLowerCase();
  return set[code] ?? (set[FALLBACK_FARMER_COUNTRY] as number);
}
