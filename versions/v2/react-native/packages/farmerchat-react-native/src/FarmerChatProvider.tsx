/**
 * FarmerChatProvider — wraps the host app (or just <FarmerChatView/>) with
 * the SDK context: config, theme (Day/Night/Auto), labels, session.
 */
import React, { useEffect, useState } from 'react';
import { FarmerChat } from './FarmerChat';
import type { FarmerChatConfig } from './core/config';
import { SdkContextProvider } from './ui/context';

export function FarmerChatProvider(props: {
  /**
   * Optional inline config — equivalent to calling FarmerChat.initialize()
   * before mounting. Ignored when the SDK is already initialized.
   */
  config?: FarmerChatConfig;
  children: React.ReactNode;
}): React.ReactElement | null {
  const [ready, setReady] = useState(false);

  if (!FarmerChat.isInitialized && props.config) {
    FarmerChat.initialize(props.config);
  }

  const sdk = FarmerChat.getInstance();

  useEffect(() => {
    let cancelled = false;
    void sdk.ready().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sdk]);

  if (!ready) return null; // storage hydration is fast; splash follows immediately

  return <SdkContextProvider sdk={sdk}>{props.children}</SdkContextProvider>;
}
