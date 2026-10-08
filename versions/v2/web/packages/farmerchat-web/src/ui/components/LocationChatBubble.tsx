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
 * The pin and ellipse are the same vectors (Material LocationOn + `fc_ellipse_icon`).
 */

import { FcIcon } from './FcIcon';

export function LocationChatBubble(props: {
  /** The human-readable address to display (e.g. `display_address` from the location response). */
  address: string;
  /** Caption shown above the address. Compose default: "Your location:". */
  label: string;
}) {
  // LocationChatBubble.kt: 290×184, 20/20/0/20, reading-secondary; a Green500@16% map header with
  // a 44dp LocationOn over the `fc_ellipse_icon` shadow (stretched 28×8); bodyMedium caption +
  // bold address footer.
  return (
    <div className="fcsdk-c-locbubble">
      <div className="fcsdk-c-locbubble-map">
        <FcIcon name="m_location_on" size={44} tint="#00C950" />
        <FcIcon name="ellipse_icon" width={28} height={8} style={{ opacity: 1 }} />
      </div>
      <div className="fcsdk-c-locbubble-footer">
        <span className="fc-t-bodyMedium" style={{ color: 'var(--fc-c-fg-secondary)' }}>{props.label}</span>
        <span className="fc-t-bodyMedium" style={{ fontWeight: 700, color: 'var(--fc-c-fg-primary)' }}>{props.address}</span>
      </div>
    </div>
  );
}
