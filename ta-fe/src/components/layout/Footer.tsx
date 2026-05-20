interface FooterProps {
  onOpenPlatform: () => void;
}

export function Footer({ onOpenPlatform }: FooterProps) {
  return (
    <footer>
      <div className="foot-inner">
        <div className="foot-logo">TRENCHER<em>.</em>AGENT</div>
        <div className="foot-links">
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
