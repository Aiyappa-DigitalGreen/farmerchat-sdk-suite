/**
 * LocationChatBubble — port of the Compose SDK `components/LocationChatBubble.kt` (2.0.0).
 *
 * A chat bubble that displays a location the user has shared, shown after location permission
 * is granted. Renders a map-style header with a location pin and a footer with the resolved
 * address (e.g. "Nandi Hills, Nandi County, Kenya").
 *
 * Metrics copied 1:1 from the Compose reference: fixed 290 x 184 card, asymmetric shape (three
 * corners at Radius.XL, bottom-right sharp, matching UserChatBubble), `Green500_16` map header
 * over `surfaceReadingSecondary`, 16/12 footer padding with a 4 gap.
 *
 * Deviation from the Compose reference (deliberate):
 *  - **Drawn pin, not a vector.** Compose uses `Icons.Filled.LocationOn` (Material vector) plus
 *    the `fc_ellipse_icon` drawable for the shadow beneath it. This package's asset set is a
 *    fixed list of PNGs rasterized from the app's drawables (see `ui/assets.ts`) and carries
 *    neither, and there is no vector/SVG primitive in the dependency set. The pin is therefore
 *    composed from plain Views at the same 44 / 28x8 metrics: a teardrop (circle + rotated
 *    square tail) in Green500 with a hollow centre, over a flattened ellipse.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context';
import { Green500, Green500_16, radius, typography } from '../theme';

/** Figma card: fixed 290 x 184. */
const CARD_WIDTH = 290;
const CARD_HEIGHT = 184;

/** Compose: `Modifier.size(44.dp)` on the pin icon. */
const PIN_SIZE = 44;

/** Compose: `fc_ellipse_icon` at 28 x 8, directly beneath the pin. */
const ELLIPSE_WIDTH = 28;
const ELLIPSE_HEIGHT = 8;

export function LocationChatBubble(props: {
  /** The human-readable address to display (the #16 response's `display_address`). */
  address: string;
  /** The caption shown above the address. Compose default: "Your location:". */
  label?: string;
}): React.ReactElement {
  const c = useTheme().content;
  return (
    <View style={[styles.card, { backgroundColor: c.surfaceReadingSecondary }]}>
      {/* Map-style header with a centered location pin — fills the height left above the
          address footer (Compose `weight(1f)`). */}
      <View style={styles.mapHeader}>
        <View style={styles.pinStack}>
          <LocationPinGlyph size={PIN_SIZE} />
          <View style={styles.ellipse} />
        </View>
      </View>

      {/* Footer with label + resolved address. */}
      <View style={styles.footer}>
        <Text style={[typography.bodyMedium, { color: c.foregroundSecondary }]}>
          {props.label ?? 'Your location:'}
        </Text>
        <Text
          style={[typography.bodyMedium, styles.address, { color: c.foregroundPrimary }]}
        >
          {props.address}
        </Text>
      </View>
    </View>
  );
}

/**
 * Map pin drawn from Views — a filled teardrop (circle + 45°-rotated square tail) with a
 * hollow centre, matching the silhouette of Material's `LocationOn` at the same 44dp box.
 *
 * Exported because the Home location pill needs the same glyph and the RN asset set carries no
 * vector pin (see the file header).
 */
export function LocationPinGlyph(props: {
  size?: number;
  color?: string;
  holeColor?: string;
}): React.ReactElement {
  const box = props.size ?? PIN_SIZE;
  const color = props.color ?? Green500;
  const head = box * 0.75;
  const hole = head * 0.36;
  return (
    <View style={{ width: box, height: box, alignItems: 'center' }}>
      <View
        style={{
          width: head,
          height: head,
          borderRadius: head / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: hole,
            height: hole,
            borderRadius: hole / 2,
            backgroundColor: props.holeColor ?? Green500_16,
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          top: head * 0.62,
          width: head * 0.56,
          height: head * 0.56,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
          zIndex: -1,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'hidden',
    // Asymmetric shape: three corners rounded (XL), bottom-right sharp.
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: 0,
  },
  mapHeader: {
    flex: 1,
    width: '100%',
    backgroundColor: Green500_16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinStack: { alignItems: 'center' },
  ellipse: {
    width: ELLIPSE_WIDTH,
    height: ELLIPSE_HEIGHT,
    borderRadius: ELLIPSE_WIDTH / 2,
    backgroundColor: Green500,
    opacity: 0.35,
  },
  footer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  address: { fontWeight: '700' },
});
