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
        <a 
          href="https://x.com/Autonomustrench" 
          target="_blank" 
          rel="noopener noreferrer" 
          style={{ display: 'flex', alignItems: 'center' }} 
          title="Follow on X"
          className="hover:text-[var(--c-accent)] transition-colors duration-200"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={{ width: '18px', height: '18px' }}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      </div>
      <button className="nav-platform-btn" onClick={onOpenPlatform} type="button">
        <span className="dot" />
        Launch Platform
      </button>
    </nav>
  );
}
