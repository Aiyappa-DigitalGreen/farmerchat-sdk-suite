import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FarmerChat, type FarmerChatConfig } from '@digitalgreenorg/farmerchat-web';

/**
 * FarmerChat as a whole web app: the full journey (language, onboarding, Home feed, chat, drawer,
 * history, settings) filling the page. This is the npm + React integration; /demo/ shows the
 * one-script-tag widget.
 *
 * Backend: DEMO, through the same-origin /stage/ proxy (web/railway/server.mjs), which adds the guest key
 * server-side because the backend's CORS rejects the SDK's headers. The illustrations come
 * from the widget build already served at /dist/illustrations/.
 */
const config: FarmerChatConfig = {
  environment: 'demo',
  customBaseUrl: `${location.origin}/stage/`,
  assetBaseUrl: `${location.origin}/dist/illustrations/`,
  mode: 'FULL_JOURNEY',
  // As the real app on DEMO: its remote config `v2_agent_5_in_hi` is false there, so it answers on
  // the synchronous endpoint (#27) with the same chat screen. DEMO's agentic endpoint fails often
  // ("Sorry, I had a problem", 503, service_unavailable; the app forced onto it fails the same way).
  // ?agentic=1 opts in for testing the streaming path.
  enableAgenticChat: new URLSearchParams(location.search).get('agentic') === '1',
  enableComposerUi: true,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FarmerChat config={config} inline />
  </StrictMode>,
);
