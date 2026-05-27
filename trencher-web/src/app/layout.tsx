import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trencher Agent — AI-Powered Solana Trench Orchestrator',
  description:
    'A 19-agent AI orchestrator that monitors Pump.fun token flow, enriches with on-chain data, screens via LLM, and executes via Jupiter Ultra. Telegram-controlled, crash-resilient, fully autonomous.',
  keywords: ['Solana', 'Pump.fun', 'trading bot', 'AI agent', 'LLM', 'Jupiter', 'trenching'],
  icons: {
    icon: '/logo.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,300;0,400;0,600;0,700;0,800;0,900;1,700&family=Barlow:wght@300;400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
