/**
 * FcIcon — tintable icon rendered from the rasterized app vector drawables.
 */
import React from 'react';
import { Image, type StyleProp, type ImageStyle } from 'react-native';
import { Icons, type IconName } from '../assets';

/**
 * The PNGs in `assets/` are cropped to the glyph (its longest side fills the 256px canvas), but
 * the app draws each icon from a 24dp vector whose glyph sits inside padding. Without this, an
 * icon at the app's dp size rendered visibly larger than on Android (the chat ✕ and globe were
 * ~1.3-1.7x). Each value is the glyph's longest side / the viewport:
 *  - fc_icon_* drawables: measured from the Android compose SDK's res/drawable/fc_icon_*.xml
 *    (rendered at 256px, alpha bounding box), e.g. language 0.75, info/share 0.836;
 *  - Material icons the app uses instead (Icons.Filled.*, 24-unit paths): Close 14/24,
 *    KeyboardArrowRight 12/24, VolumeUp 18/24, PlayArrow/Pause 14/24, Refresh 16/24,
 *    Check 17.2/24, Menu 18/24, History 21/24.
 * Icons not listed render full-size, as before. The layout box stays `size`; the glyph is
 * centred in it.
 */
const GLYPH_FRACTION: Partial<Record<IconName, number>> = {
  arrowDown: 0.672,
  camera: 0.961,
  card: 0.836,
  help: 0.75,
  home: 0.711,
  info: 0.836,
  language: 0.75,
  mic: 0.93,
  save: 0.785,
  send: 0.969,
  settings: 0.836,
  share: 0.836,
  sms: 0.719,
  history: 21 / 24,
  whatsapp: 0.75,
  close: 14 / 24,
  chevronRight: 12 / 24,
  speaker: 18 / 24,
  play: 14 / 24,
  pause: 14 / 24,
  refresh: 16 / 24,
  check: 17.2 / 24,
  menu: 18 / 24,
};

export function FcIcon(props: {
  name: IconName;
  size?: number;
  tint?: string;
  style?: StyleProp<ImageStyle>;
}): React.ReactElement {
  const size = props.size ?? 24;
  const glyph = size * (GLYPH_FRACTION[props.name] ?? 1);
  const inset = (size - glyph) / 2;
  return (
    <Image
      source={Icons[props.name]}
      resizeMode="contain"
      style={[
        { width: glyph, height: glyph, margin: inset },
        props.tint ? { tintColor: props.tint } : null,
        props.style,
      ]}
    />
  );
}
