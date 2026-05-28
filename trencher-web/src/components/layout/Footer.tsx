interface FooterProps {
  onOpenPlatform: () => void;
}

export function Footer({ onOpenPlatform }: FooterProps) {
  return (
    <footer>
      <div className="foot-inner">
        <div className="foot-logo">TRENCHER<em>.</em>AGENT</div>
        <div className="foot-links">
          <a 
            href="https://x.com/Autonomustrench" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            className="hover:text-[var(--c-accent)] transition-colors duration-200"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={{ width: '16px', height: '16px' }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Twitter / X
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); onOpenPlatform(); }}>Platform</a>
          <a href="#pipeline">Pipeline</a>
          <a href="#layers">Agents</a>
          <a href="#strategies">Strategies</a>
          <a href="#config">Docs</a>
        </div>
        <div className="foot-copy">Forked from yunus-0x/charon · MIT License</div>
      </div>
    </footer>
  );
}
