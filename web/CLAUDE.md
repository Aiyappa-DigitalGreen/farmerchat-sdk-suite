# Web rules (adds to root CLAUDE.md — read that first)

- Package `@digitalgreenorg/farmerchat-web`, TypeScript strict, React 18 peer, vite library build (ESM+CJS+d.ts), zero runtime deps beyond react.
- Standalone core (do NOT import from react-native package) with identical semantics: AbortController timeouts, retry table, single-flight 401 refresh, `fc_sdk_` localStorage keys.
- Styles must be scoped (CSS modules / prefixed classes) — the component embeds in arbitrary host pages; no global resets, no body styling.
- Voice via MediaRecorder (webm/opus) behind capability detection; camera via `<input capture>`; geolocation via navigator API — all optional-degrade, never crash.
- Verify: `npx tsc --noEmit` + `vite build` clean before claiming done; record in docs/04.
