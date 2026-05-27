'use client';

import { NAV_LINKS } from '@/constants/platform';

interface NavProps {
  onOpenPlatform: () => void;
}

export function Nav({ onOpenPlatform }: NavProps) {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <nav>
      <div className="nav-logo" onClick={scrollToTop} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src="/logo.png" alt="Trencher Agent Logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
        <span>TRENCHER<em>.</em>AGENT</span>
      </div>
      <div className="nav-links">
        {NAV_LINKS.map(link => (
          <a key={link.href} href={link.href}>{link.label}</a>
        ))}
      </div>
      <button className="nav-platform-btn" onClick={onOpenPlatform} type="button">
        <span className="dot" />
        Launch Platform
      </button>
    </nav>
  );
}
