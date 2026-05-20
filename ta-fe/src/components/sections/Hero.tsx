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
        <div className="hero-tag">Solana · Pump.fun · LLM-Powered · 19 Agents</div>
        <h1 className="hero-h1">
          THE<br />TRENCH<br /><span>AGENT</span>
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
