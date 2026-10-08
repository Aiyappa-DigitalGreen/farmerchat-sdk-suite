// Vite `?inline` imports resolve to a data: URI string at build time.
declare module '*?inline' {
  const src: string;
  export default src;
}
