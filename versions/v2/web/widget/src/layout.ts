/** Below this viewport height a floating panel would squeeze the SDK; use the full-screen sheet. */
export const FULLSCREEN_MAX_HEIGHT = 560;

/**
 * When should the floating panel take over the whole viewport?
 *
 * Called on mount and on every resize/orientation change.
 *
 * Fullscreen when the viewport is narrower than the panel plus 80 px of slack (phones, narrow
 * windows) OR shorter than {@link FULLSCREEN_MAX_HEIGHT} (landscape phones, e.g. 844×390, where a
 * floating panel would leave the SDK about 300 px). Tablets and laptops keep the floating panel.
 *
 * @param viewportWidth  window.innerWidth in CSS px
 * @param viewportHeight window.innerHeight in CSS px
 * @param panelWidth     the configured floating panel width
 * @param _panelHeight   the configured floating panel height (the panel's max-height clamp already
 *                       fits it to any viewport taller than the cutoff)
 * @returns true → fullscreen sheet (launcher hidden, in-panel close bar shown)
 */
export function shouldUseFullscreen(
  viewportWidth: number,
  viewportHeight: number,
  panelWidth: number,
  _panelHeight: number,
): boolean {
  return viewportWidth < panelWidth + 80 || viewportHeight < FULLSCREEN_MAX_HEIGHT;
}
