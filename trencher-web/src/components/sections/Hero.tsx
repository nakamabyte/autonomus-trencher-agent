'use client';

import { useEffect } from 'react';
import { useConstellation } from '@/hooks/useConstellation';
import { HERO_STATS } from '@/constants/platform';

interface HeroProps {
  onOpenPlatform: () => void;
}

export function Hero({ onOpenPlatform }: HeroProps) {
  useConstellation('hero-canvas', 0.38);

  return (
    <section id="hero">
      <svg id="hero-canvas" />
      <div className="hero-inner">
        <div
          className="inline-flex items-center mb-10 w-fit border rounded-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            padding: '7px',
            marginBottom: '10px'
          }}
        >
          <a
            href="https://pump.fun/coin/BuFWUxhWGJWsCCp5wEtww9YLazfUHMUJkQsuje1gpump"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 font-mono text-white"
            style={{
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
              letterSpacing: '0.05em'
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>CA:</span>
            BuFWUxhWGJWsCCp5wEtww9YLazfUHMUJkQsuje1gpump
          </a>
        </div>
        <div className="hero-tag">Solana · Pump.fun · LLM-Powered · 19 Agents</div>
        <h1 className="hero-h1">
          AUTONOMOUS<br />TRENCHER<br /><span>AGENT</span>
        </h1>
        <p className="hero-sub">
          A 19-agent AI orchestrator that monitors Pump.fun token flow, enriches with on-chain data,
          screens via LLM, and executes via Jupiter Ultra. Telegram-controlled, crash-resilient,
          fully autonomous.
        </p>
        <div className="hero-actions">
          <button className="btn-red" onClick={onOpenPlatform} type="button">
            Launch Platform
          </button>
          <a href="#pipeline" className="btn-ghost">See Architecture</a>
        </div>
        <div className="hero-meta">
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="hero-stat">
              <div className="hs-n">{stat.value}<span>{stat.suffix}</span></div>
              <div className="hs-l">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
