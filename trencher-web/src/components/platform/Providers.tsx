'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import SolanaWalletProvider from './SolanaWalletProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SolanaWalletProvider>
        {children}
      </SolanaWalletProvider>
    </SessionProvider>
  );
}
