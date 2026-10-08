/**
 * When should the floating panel take over the whole viewport?
 *
 * Called on mount and on every resize/orientation change.
 *
 * @param viewportWidth  window.innerWidth in CSS px
 * @param viewportHeight window.innerHeight in CSS px
 * @param panelWidth     the configured floating panel width
 * @param panelHeight    the configured floating panel height
 * @returns true → fullscreen sheet (launcher hidden, in-panel ✕ shown)
 */
export function shouldUseFullscreen(
  viewportWidth: number,
  viewportHeight: number,
  panelWidth: number,
  panelHeight: number,
): boolean {
  // TODO(you): decide the breakpoint policy — see the notes in the README "Layout" section.
  void viewportHeight;
  void panelHeight;
  return viewportWidth < panelWidth + 80;
}
