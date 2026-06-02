'use client';

export function Ecosystem() {
  return (
    <section id="ecosystem" style={{ padding: '80px 0', background: '#0A0A0A', color: '#fff', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="wrap" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 40px' }}>
        <div className="sec-label" style={{ color: '#D62828', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          Ecosystem & Tokenomics
        </div>
        <h2 className="sec-h2" style={{ fontFamily: 'var(--fc)', fontSize: 'clamp(48px, 6vw, 72px)', fontWeight: 900, textTransform: 'uppercase', marginBottom: '40px', lineHeight: 1 }}>
          <span style={{ color: '#D62828' }}>$AUTR</span> Token <br/>& Burn Mechanics
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--fb)', fontSize: '24px', fontWeight: 600, marginBottom: '20px' }}>Deploy Fees</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: '20px' }}>
              Users pay SOL to deploy agents via Trenchyard. Deploy fees vary by breed tier: Tier 1 (0.025 SOL), Tier 2 (0.05 SOL), Tier 3 (0.1 SOL), and Commander (0.2 SOL).
            </p>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
              This tiered structure ensures high-value strategic agents contribute sustainably to the network's liquidity and operational reserves.
            </p>
          </div>
          
          <div>
            <h3 style={{ fontFamily: 'var(--fb)', fontSize: '24px', fontWeight: 600, marginBottom: '20px' }}>Deflationary Burn</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: '20px' }}>
              We use a deflationary fee split mechanism for every deployment:
            </p>
            <ul style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.8, paddingLeft: '20px', marginBottom: '20px' }}>
              <li><strong>25%</strong> is used to auto-buyback and burn $AUTR via Jupiter</li>
              <li><strong>25%</strong> goes to a holder reward pool</li>
              <li><strong>25%</strong> funds the agent treasury</li>
              <li><strong>25%</strong> funds operations and development</li>
            </ul>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
              The auto-burn cycles run automatically every 6 hours, creating constant buy pressure and reducing total supply permanently.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
