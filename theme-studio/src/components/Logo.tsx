/* FarmerChat logo mark. Renders the real asset (public/assets/fc_logo_mark.png)
 * as a CSS mask so it takes the current text color — exactly how the SDK tints
 * its black+alpha assets at runtime. Set the color via a `text-*` class or an
 * inline `color`, and the mark follows it. */
import type { CSSProperties } from "react"

const MASK = "url(/assets/fc_logo_mark.png)"

export function Logo({ size = 30, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-block",
        flex: "none",
        width: size,
        height: size,
        background: "currentColor",
        WebkitMaskImage: MASK,
        maskImage: MASK,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        ...style,
      }}
    />
  )
}
