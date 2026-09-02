/**
 * Asset registry — PNGs rasterized from the app's vector drawables
 * (fc_logo_mark, fc_icon_*) plus the glow/weather rasters copied as-is.
 * Icon PNGs are black + alpha and recolored at runtime via Image tintColor.
 */
import logoMark from '../assets/fc_logo_mark.png';
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
import iconTimer from '../assets/fc_icon_timer.png';
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
import glowYellow from '../assets/fc_glow_yellow.png';
import glowGreen from '../assets/fc_glow_green.png';
import weatherSunClouds from '../assets/fc_weather_sunclouds.png';
import weatherSun from '../assets/fc_weather_sun.png';
import weatherRain from '../assets/fc_weather_rain.png';

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
  timer: iconTimer,
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
} as const;

export type IconName = keyof typeof Icons;

export const Assets = {
  logoMark,
  glowYellow,
  glowGreen,
  weatherSunClouds,
  weatherSun,
  weatherRain,
} as const;
