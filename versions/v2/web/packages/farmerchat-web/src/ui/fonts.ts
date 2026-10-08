/**
 * Roboto, bundled. Compose renders `FontFamily.SansSerif`, which is Roboto on Android; a web
 * page has no guaranteed Roboto (macOS ships none), and without it no text metric matches.
 * Inlined as data URIs because the SDK embeds in arbitrary host pages and must not fetch
 * from a font CDN. Variable font (wght 100–900), latin + latin-ext, SIL OFL 1.1.
 * Other scripts (Devanagari, Kannada, …) fall through to the platform's Noto/system fonts,
 * as they do on Android.
 */
import latin from '@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2?inline';
import latinExt from '@fontsource-variable/roboto/files/roboto-latin-ext-wght-normal.woff2?inline';

export function robotoFontFaces(): string {
  const face = (src: string, range: string) =>
    `@font-face{font-family:"FC Roboto";font-style:normal;font-display:swap;font-weight:100 900;` +
    `src:url(${src}) format("woff2-variations"),url(${src}) format("woff2");unicode-range:${range};}\n`;
  return (
    face(latinExt, 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF') +
    face(latin, 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD')
  );
}
