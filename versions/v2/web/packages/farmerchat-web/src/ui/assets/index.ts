// Raster drawables from the compose module (scripts/gen-assets.py), inlined as data URIs so
// the SDK never fetches assets from a host page's origin.
import bootBg from './boot_bg.webp?inline';
import glowGreen from './glow_green.webp?inline';
import glowYellow from './glow_yellow.webp?inline';
import weatherRain from './weather_rain.png?inline';
import weatherSun from './weather_sun.png?inline';
import weatherSunClouds from './weather_sunclouds.png?inline';
import flagIndia from './flag_india.png?inline';

export const Assets = { bootBg, glowGreen, glowYellow, weatherRain, weatherSun, weatherSunClouds, flagIndia };
