/**
 * LocationChatBubble (SDK 2.0.0) — a chat bubble showing a location the farmer has shared, in
 * place of the text bubble they would otherwise have sent.
 *
 * Port of the Compose reference `components/LocationChatBubble.kt`. Geometry read dp-for-px:
 * a fixed 290x184 card, three corners rounded at Radius.XL (20px) with the bottom-right sharp
 * (the same asymmetric shape `UserChatBubble` uses, because this IS a user-side message), a
 * tinted map-style header filling the space above the footer with a centred pin over a small
 * ellipse "shadow", then a footer carrying a muted caption above the bold address.
 *
 * The pin and its ellipse are inline SVG rather than the Kotlin's `Icons.Filled.LocationOn` +
 * `R.drawable.fc_ellipse_icon`: this package ships no image assets (docs/03 web packaging), so
 * vector marks are drawn in place. Everything else — sizes, colours, weights — matches.
 */

/** The pin + ellipse mark centred in the map header (Compose: 44dp icon over a 28x8 ellipse). */
function LocationMark() {
  return (
    <span className="fcsdk-locbubble-mark" aria-hidden>
      <svg width="44" height="44" viewBox="0 0 24 24" role="presentation" focusable="false">
        {/* Material "location_on" path, so the mark reads identically to the Compose icon. */}
        <path
          fill="currentColor"
          d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
        />
      </svg>
      <svg width="28" height="8" viewBox="0 0 28 8" role="presentation" focusable="false">
        <ellipse cx="14" cy="4" rx="14" ry="4" fill="currentColor" opacity="0.24" />
      </svg>
    </span>
  );
}

export function LocationChatBubble(props: {
  /** The human-readable address to display (e.g. `display_address` from the location response). */
  address: string;
  /** Caption shown above the address. Compose default: "Your location:". */
  label: string;
}) {
  return (
    <div className="fcsdk-locbubble">
      <div className="fcsdk-locbubble-map">
        <LocationMark />
      </div>
      <div className="fcsdk-locbubble-footer">
        <span className="fcsdk-locbubble-caption">{props.label}</span>
        <span className="fcsdk-locbubble-address">{props.address}</span>
      </div>
    </div>
  );
}
