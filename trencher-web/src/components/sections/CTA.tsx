'use client';

import { useConstellation } from '@/hooks/useConstellation';

interface CTAProps {
  onOpenPlatform: () => void;
}

export function CTA({ onOpenPlatform }: CTAProps) {
  useConstellation('cta-canvas', 0.5);

  return (
    <section id="cta">
      <svg id="cta-canvas" />
      <div className="wrap cta-inner">
        <p className="cta-label">Signal Server Key Required</p>
        <h2 className="cta-h">Start<br /><span>Trenching</span></h2>
        <p className="cta-sub">
          Request your signal server key to access real-time Pump.fun token flow. Or launch the
          dashboard demo now.
        </p>
        <div className="cta-actions">
          <button className="btn-red" onClick={onOpenPlatform} type="button">
            Launch Platform
          </button>
          <a href="#config" className="btn-ghost">Read the Docs</a>
        </div>
        <p className="cta-note">Self-hosted · MIT License · Forked from yunus-0x/charon</p>
      </div>
    </section>
  );
}
