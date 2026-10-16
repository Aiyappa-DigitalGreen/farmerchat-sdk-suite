import type { CSSProperties, ReactElement } from 'react';
import { ICONS, type IconDef, type IconName } from '../icons';

export type { IconName };

/**
 * Renders one of the compose module's vector drawables (see scripts/gen-icons.py).
 *
 * Mirrors the two Compose call styles:
 *  - `Icon(painterResource(..), tint = X)`  → pass `tint`: every painted path takes that colour
 *    (`'currentColor'` follows the surrounding text colour).
 *  - `Image(painterResource(..))`           → omit `tint`: the drawable's own colours are kept.
 *
 * `size` is the rendered box in px (= dp); when only one of width/height is given the
 * drawable's aspect ratio is kept, as `Modifier.size`/`height` would.
 */
/** A drawable fill that paints nothing (`#00000000` in the XML, e.g. a stroke-only icon). */
const TRANSPARENT_FILL = /^(none|transparent|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(\.0*)?\s*\)|#[0-9a-f]{6}00|#[0-9a-f]{3}0)$/i;

export function FcIcon(props: {
  name: IconName;
  size?: number;
  width?: number;
  height?: number;
  tint?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}): ReactElement {
  const def: IconDef = ICONS[props.name];
  const ratio = def.w / def.h;
  let w = props.width ?? props.size;
  let h = props.height ?? props.size;
  if (w == null && h == null) {
    w = def.w;
    h = def.h;
  } else if (w == null) w = (h as number) * ratio;
  else if (h == null) h = w / ratio;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${def.vw} ${def.vh}`}
      className={props.className}
      style={{ display: 'block', flex: '0 0 auto', ...props.style }}
      role={props.title ? 'img' : undefined}
      aria-hidden={props.title ? undefined : true}
      aria-label={props.title}
      focusable="false"
    >
      {def.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          // Compose's tint is a SrcIn colour filter: transparent pixels stay transparent, so a
          // transparent fill must stay unpainted rather than take the tint (icon_share was solid).
          fill={!p.fill || TRANSPARENT_FILL.test(p.fill) ? 'none' : props.tint ?? p.fill}
          fillOpacity={p.fillOpacity}
          fillRule={p.fillRule as 'evenodd' | undefined}
          stroke={p.stroke ? props.tint ?? p.stroke : undefined}
          strokeWidth={p.strokeWidth}
          strokeLinecap={p.strokeLinecap as 'round' | undefined}
          strokeLinejoin={p.strokeLinejoin as 'round' | undefined}
          strokeOpacity={p.strokeOpacity}
        />
      ))}
    </svg>
  );
}
