import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FarmerChat, type FarmerChatConfig } from '@digitalgreenorg/farmerchat-web';

/**
 * FarmerChat as a whole web app: the full journey (language, onboarding, Home feed, chat, drawer,
 * history, settings) filling the page. This is the npm + React integration; /demo/ shows the
 * one-script-tag widget.
 *
 * Backend: the same-origin /stage/ proxy (web/railway/server.mjs), which adds the guest key
 * server-side because the stage backend's CORS rejects the SDK's headers. The illustrations come
 * from the widget build already served at /dist/illustrations/.
 */
const config: FarmerChatConfig = {
  environment: 'stage',
  customBaseUrl: `${location.origin}/stage/`,
  assetBaseUrl: `${location.origin}/dist/illustrations/`,
  mode: 'FULL_JOURNEY',
  enableAgenticChat: true,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FarmerChat config={config} inline />
  </StrictMode>,
);
