'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface StepSectionProps {
  number: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function StepSection({ number, title, isOpen, onToggle, children }: StepSectionProps) {
  return (
    <div style={{
      background: '#0d0d12',
      border: isOpen ? '1px solid rgba(255, 179, 71, 0.4)' : '1px solid #1a1a28',
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '16px',
      transition: 'all 0.25s ease',
      boxShadow: isOpen ? '0 0 16px rgba(255, 179, 71, 0.05)' : 'none',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '18px 24px',
          background: isOpen ? 'rgba(255, 179, 71, 0.02)' : 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: isOpen ? '#FFB347' : '#1a1a2c',
          color: isOpen ? '#050508' : '#888',
          fontSize: '13px',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          transition: 'all 0.2s',
        }}>
          {number}
        </span>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          flex: 1,
        }}>
          {title}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: '#888',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          padding: '24px',
          borderTop: '1px solid #1a1a28',
          background: '#07070b',
          fontSize: '12px',
          color: '#aaa',
          lineHeight: '1.7',
          fontFamily: "'Barlow', sans-serif",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

interface FaqItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FaqItem({ question, answer, isOpen, onToggle }: FaqItemProps) {
  return (
    <div style={{
      borderBottom: '1px solid #1a1a24',
      padding: '12px 0',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          color: '#fff',
          textAlign: 'left',
          fontSize: '13px',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          cursor: 'pointer',
          padding: '8px 0',
        }}
      >
        <span>{question}</span>
        <span style={{ color: '#00C896', fontSize: '16px' }}>{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <p style={{
          fontSize: '12px',
          color: '#888',
          lineHeight: '1.6',
          paddingTop: '8px',
          fontFamily: "'Barlow', sans-serif",
        }}>
          {answer}
        </p>
      )}
    </div>
  );
}

function CodeBlock({ code, title }: { code: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ background: '#000', borderRadius: '4px', overflow: 'hidden', marginTop: '8px', border: '1px solid #1a1a24' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: '#111', borderBottom: '1px solid #1a1a24' }}>
        <span style={{ color: '#aaa', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>{title}</span>
        <button onClick={handleCopy} style={{ background: 'none', border: 'none', color: copied ? '#00C896' : '#666', fontSize: '11px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>
          {copied ? 'COPIED!' : 'COPY'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '12px', overflowX: 'auto', color: '#4FC3F7', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function GuidePage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<number | null>(1);
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set([0]));

  const toggleStep = useCallback((step: number) => {
    setActiveStep(prev => (prev === step ? null : step));
  }, []);

  const toggleFaq = useCallback((index: number) => {
    setOpenFaqs(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050508',
      color: '#eee',
      fontFamily: "'Barlow', sans-serif",
      paddingBottom: '80px',
    }}>
      {/* Header Bar */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1a1a24',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        background: '#08080c',
      }}>
        <button
          className="pv-back"
          style={{ marginRight: 0 }}
          onClick={() => router.push('/')}
        >
          ← BACK TO HOME
        </button>
        <div
          onClick={() => router.push('/')}
          style={{
            color: '#00C896',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            cursor: 'pointer',
          }}
        >
          TRENCHER AGENT
        </div>
        <div style={{
          fontSize: '12px',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#888',
          marginLeft: 'auto',
        }}>
          HOLDER GUIDE
        </div>
      </div>

      {/* Main Container */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px 24px',
      }}>
        {/* Intro */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '36px',
            fontWeight: 900,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#fff',
            marginBottom: '12px',
          }}>
            Non-Dev Holder User Guide
          </h1>
          <p style={{
            color: '#888',
            fontSize: '14px',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            A complete, step-by-step manual to unlock private repository access, explore the dashboard, and connect to signal API. No coding experience needed.
          </p>
        </div>

        {/* Steps */}
        <div>
          {/* STEP 1 */}
          <StepSection
            number="1"
            title="Verify Your Holdings"
            isOpen={activeStep === 1}
            onToggle={() => toggleStep(1)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Requirements:</strong>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  <li>Solana Wallet (Phantom/Solflare) containing at least <span style={{ color: '#FFB347', fontWeight: 'bold' }}>10,000,000 $AUTR</span> (1% of total supply).</li>
                  <li>GitHub account (free to register at <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ color: '#00C896' }}>github.com</a>).</li>
                </ul>
              </div>

              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Verification Procedure:</strong>
                <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Navigate to the <span style={{ color: '#fff' }}>Verify Holder</span> page on the website.</li>
                  <li>Click <strong>Select Wallet</strong> and connect your Solana wallet.</li>
                  <li>Click <strong>Sign in with GitHub</strong> to authorize the connection.</li>
                  <li>Click <strong>Verify Token & Get Access</strong>.</li>
                  <li>The system verifies your wallet holdings. If successful, you will receive an automated invitation to the private repository.</li>
                </ol>
              </div>

              <div style={{
                background: 'rgba(255, 107, 107, 0.05)',
                border: '1px solid rgba(255, 107, 107, 0.2)',
                padding: '12px 16px',
                borderRadius: '4px',
                color: '#FF6B6B',
                fontSize: '11px',
              }}>
                <strong>Crucial Note:</strong> Token validation is dynamic. If your balance drops below 10,000,000 $AUTR, access is revoked automatically. Re-purchasing to 1% restores access instantly.
              </div>
            </div>
          </StepSection>

          {/* STEP 2 */}
          <StepSection
            number="2"
            title="Access the Private Repository"
            isOpen={activeStep === 2}
            onToggle={() => toggleStep(2)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>
                Once verified, access the repository at: <a href="https://github.com/zero520-dot/trencher-agent" target="_blank" rel="noopener noreferrer" style={{ color: '#00C896', wordBreak: 'break-all' }}>github.com/zero520-dot/trencher-agent</a>
              </p>
              <p>
                Inside the repository, you will find:
              </p>
              <ul style={{ paddingLeft: '20px', margin: 0 }}>
                <li><strong style={{ color: '#fff' }}>trencher-core:</strong> The automated backend engine (Node.js).</li>
                <li><strong style={{ color: '#fff' }}>trencher-web:</strong> The responsive platform dashboard (Next.js).</li>
                <li><strong style={{ color: '#fff' }}>signal-server:</strong> The signal aggregation and parser middleware.</li>
              </ul>
              <p style={{ fontStyle: 'italic', color: '#666' }}>
                Note: Non-dev holders do not need to look at or configure the source code. You can fully benefit from the system using the pre-deployed dashboard and simple signal endpoints.
              </p>
            </div>
          </StepSection>

          {/* STEP 3 */}
          <StepSection
            number="3"
            title="Explore the Dashboard"
            isOpen={activeStep === 3}
            onToggle={() => toggleStep(3)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p>
                Launch the application suite directly by clicking <strong>Launch Platform</strong> on the homepage.
              </p>

              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '6px' }}>Three Main Navigation Sections:</strong>
                <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li>
                    <span style={{ color: '#4FC3F7', fontWeight: 'bold' }}>AGENT GRAPH:</span>
                    {' '}A live visual map showcasing all active trading nodes and information flow routing across the core layers.
                  </li>
                  <li>
                    <span style={{ color: '#00C896', fontWeight: 'bold' }}>CONSCIOUSNESS:</span>
                    {' '}The agent’s real-time thinking feed. Shows decisions with color tags:
                    <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
                      <li><span style={{ color: '#00C896' }}>● BUY</span>: Token passed filters and is purchased.</li>
                      <li><span style={{ color: '#FF6B6B' }}>○ SKIP</span>: Token was scanned but failed criteria (with reason).</li>
                      <li><span style={{ color: '#FFB347' }}>◐ ESCALATE</span>: Passed to Grok LLM for validation.</li>
                    </ul>
                  </li>
                  <li>
                    <span style={{ color: '#FFB347', fontWeight: 'bold' }}>TRENCHYARD:</span>
                    {' '}The agent profile registry, stats center, win rates, net profit/loss tracking, and the 12-breed strategy index.
                  </li>
                </ul>
              </div>

              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Top Header Metrics:</strong>
                <p>Displays runtime stats including current execution mode, strategy rules, open trade counts, net PnL (SOL), cycle latency, and system uptime.</p>
              </div>
            </div>
          </StepSection>

          {/* STEP 4 */}
          <StepSection
            number="4"
            title="Connect to the Signal API"
            isOpen={activeStep === 4}
            onToggle={() => toggleStep(4)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p>
                As a verified holder, you can stream processed signals directly into your own tools, spreadsheet trackers, or webhooks.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><span style={{ color: '#666' }}>API Endpoint:</span> <code style={{ color: '#fff', background: '#111', padding: '2px 6px', borderRadius: '3px' }}>GET https://autonomustrencheragent.tech/api/signals</code></div>
                <div><span style={{ color: '#666' }}>Authentication:</span> Header <code style={{ color: '#fff', background: '#111', padding: '2px 6px', borderRadius: '3px' }}>x-api-key: YOUR_API_KEY</code> (get your key from the private Telegram group)</div>
              </div>

              {/* CURL */}
              <div>
                <span style={{ fontSize: '10px', color: '#666', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>cURL Query</span>
                <pre style={{
                  background: '#000',
                  color: '#00C896',
                  padding: '12px',
                  borderRadius: '4px',
                  overflowX: 'auto',
                  fontFamily: "'JetBrains Mono', monospace",
                  margin: '4px 0 0 0',
                }}>
                  {`curl -H "x-api-key: YOUR_API_KEY" https://autonomustrencheragent.tech/api/signals`}
                </pre>
              </div>

              {/* PYTHON */}
              <div>
                <span style={{ fontSize: '10px', color: '#666', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>Python Implementation</span>
                <pre style={{
                  background: '#000',
                  color: '#4FC3F7',
                  padding: '12px',
                  borderRadius: '4px',
                  overflowX: 'auto',
                  fontFamily: "'JetBrains Mono', monospace",
                  margin: '4px 0 0 0',
                }}>
                  {`import requests

headers = {"x-api-key": "YOUR_API_KEY"}
r = requests.get("https://autonomustrencheragent.tech/api/signals", headers=headers)
print(r.json())`}
                </pre>
              </div>

              {/* JS */}
              <div>
                <span style={{ fontSize: '10px', color: '#666', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>JavaScript / Node.js</span>
                <pre style={{
                  background: '#000',
                  color: '#CE93D8',
                  padding: '12px',
                  borderRadius: '4px',
                  overflowX: 'auto',
                  fontFamily: "'JetBrains Mono', monospace",
                  margin: '4px 0 0 0',
                }}>
                  {`const res = await fetch("https://autonomustrencheragent.tech/api/signals", {
  headers: { "x-api-key": "YOUR_API_KEY" }
});
const data = await res.json();
console.log(data);`}
                </pre>
              </div>
            </div>
          </StepSection>

          {/* STEP 5 */}
          <StepSection
            number="5"
            title="Run Your Own Agent (Advanced)"
            isOpen={activeStep === 5}
            onToggle={() => toggleStep(5)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>System Requirements:</strong>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  <li>Node.js v18 or higher installed on your local computer or VPS.</li>
                  <li>API Keys from Helius RPC provider, DeepSeek (T1 screening), and Grok (T2 valuation).</li>
                  <li>Solana wallet credentials containing a small balance of SOL for trade capital.</li>
                </ul>
              </div>

              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Setup Guide:</strong>
                <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>
                    Clone the codebase:
                    <pre style={{ background: '#000', color: '#aaa', padding: '6px 10px', borderRadius: '3px', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                      {`git clone https://github.com/zero520-dot/trencher-agent.git\ncd trencher-agent`}
                    </pre>
                  </li>
                  <li>
                    Install Node modules:
                    <pre style={{ background: '#000', color: '#aaa', padding: '6px 10px', borderRadius: '3px', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                      {`cd trencher-core && npm install\ncd ../signal-server && npm install`}
                    </pre>
                  </li>
                  <li>
                    Create configuration environment variables:
                    <pre style={{ background: '#000', color: '#aaa', padding: '6px 10px', borderRadius: '3px', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                      {`cp .env.example .env`}
                    </pre>
                  </li>
                  <li>Open the newly created <code style={{ color: '#fff' }}>.env</code> file in a text editor and fill in your keys (<code style={{ color: '#FFB347' }}>HELIUS_API_KEY</code>, <code style={{ color: '#FFB347' }}>DEEPSEEK_API_KEY</code>, <code style={{ color: '#FFB347' }}>SOLANA_PRIVATE_KEY</code>).</li>
                  <li>
                    Launch the signal server:
                    <pre style={{ background: '#000', color: '#aaa', padding: '6px 10px', borderRadius: '3px', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                      {`cd signal-server && npm start`}
                    </pre>
                  </li>
                  <li>
                    Launch the main core bot:
                    <pre style={{ background: '#000', color: '#aaa', padding: '6px 10px', borderRadius: '3px', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                      {`cd trencher-core && npm start`}
                    </pre>
                  </li>
                  <li>Verify connection by sending <code style={{ color: '#fff' }}>/mode dry</code> to your custom Telegram bot client to initialize simulated risk-free dry trading.</li>
                </ol>
              </div>

              <div style={{
                background: 'rgba(0, 200, 150, 0.05)',
                border: '1px solid rgba(0, 200, 150, 0.2)',
                padding: '12px 16px',
                borderRadius: '4px',
                color: '#00C896',
                fontSize: '11px',
              }}>
                <strong>Protip:</strong> Keep the bot in dry run mode for at least 50 trades. Review performance and logs before sending <code style={{ color: '#fff' }}>/mode live</code>.
              </div>
            </div>
          </StepSection>

          {/* STEP 6 */}
          <StepSection
            number="6"
            title="Telegram Commands"
            isOpen={activeStep === 6}
            onToggle={() => toggleStep(6)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ marginBottom: '8px' }}>Interact with your deployed agent using the following Telegram chatbot controls:</p>
              {[
                { cmd: '/start', desc: 'Initialize and launch the bot monitoring tasks.' },
                { cmd: '/stop', desc: 'Halt the scraper and trade execution pipelines.' },
                { cmd: '/status', desc: 'View current active modes, targets, and open positions.' },
                { cmd: '/positions', desc: 'Display a details list of open trade logs.' },
                { cmd: '/pnl', desc: 'Summarize profit, loss, win rate, and drawdown metrics.' },
                { cmd: '/mode dry', desc: 'Switch execution into risk-free paper trading mode.' },
                { cmd: '/mode live', desc: 'Switch execution into live-capital trading mode.' },
                { cmd: '/learn', desc: 'Trigger the Grok learning pipeline on recent trades.' },
                { cmd: '/lessons', desc: 'Read rules compiled by the learning module.' },
                { cmd: '/addwallet <addr>', desc: 'Add a wallet to the smart-money tracking index.' },
                { cmd: '/wallets', desc: 'View all tracked smart-money wallets.' },
                { cmd: '/removewallet <addr>', desc: 'Remove a wallet from tracking index.' },
              ].map(c => (
                <div key={c.cmd} style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '12px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  padding: '6px 8px',
                  background: 'rgba(255,255,255,0.01)',
                  borderBottom: '1px solid #14141c',
                }}>
                  <strong style={{ color: '#FFB347', width: '130px', flexShrink: 0 }}>{c.cmd}</strong>
                  <span style={{ color: '#888' }}>— {c.desc}</span>
                </div>
              ))}
            </div>
          </StepSection>

          {/* STEP 7 */}
          <StepSection
            number="7"
            title="Institutional Partner API"
            isOpen={activeStep === 7}
            onToggle={() => toggleStep(7)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p>
                Trencher Core supports a parallel execution pipeline designed for institutional partners like Hatcher Labs. This allows partners to receive mirror signals and execute trades using their own capital without exposing private keys.
              </p>

              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>Core Principles:</strong>
                <ul style={{ paddingLeft: '20px', margin: 0 }}>
                  <li><strong>Zero-Custody:</strong> Trencher never holds partner funds. It only provides <code>unsigned_transaction</code> payloads for the partner to sign.</li>
                  <li><strong>Parallel Execution:</strong> Partner proposal generation runs completely asynchronously (fire-and-forget) to ensure the main Trencher bot never slows down.</li>
                  <li><strong>Hardcoded Caps Floor:</strong> Partner risk limits are clamped to a minimum floor (e.g., max 0.1% trade, 0.5% daily loss) to protect the underlying risk framework from erroneous inputs.</li>
                </ul>
              </div>

              <div>
                <strong style={{ color: '#fff', display: 'block', marginBottom: '4px' }}>REST API Endpoints:</strong>
                <p style={{ marginBottom: '8px' }}>Partners must authenticate using a Bearer token (<code>Authorization: Bearer hatcher_YOUR_API_KEY</code>).</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  <div style={{ background: '#111', padding: '12px', borderRadius: '4px' }}>
                    <div style={{ color: '#00C896', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px' }}>GET /partner/v1/agents/&#123;agent_id&#125;/propose</div>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>Polls for new unsigned transactions and intelligence. Returns Base64 Tx and signal read.</div>
                    <CodeBlock 
                      title="Response (Success)" 
                      code={`{
  "proposal_id": "uuid",
  "unsigned_transaction": "<base64_v0_tx>",
  "decision": {
    "lane": "tg_alpha",
    "caller": "Brando",
    "verdict": "BUY",
    "signals": { ... }
  },
  "caps_check": {
    "max_trade_bps_of_wallet": 50,
    ...
  }
}`}
                    />
                  </div>

                  <div style={{ background: '#111', padding: '12px', borderRadius: '4px' }}>
                    <div style={{ color: '#4FC3F7', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px' }}>PUT /partner/v1/agents/&#123;agent_id&#125;/caps</div>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>Updates the partner's risk tolerance caps. Note: Subject to hardcoded minimum safety floors.</div>
                    <CodeBlock 
                      title="Request Body" 
                      code={`{
  "max_trade_bps_of_wallet": 50, // 0.5% max per trade
  "max_daily_loss_bps": 300,     // 3% max daily loss
  "max_open_positions": 2        // Max 2 concurrent positions
}`}
                    />
                  </div>

                  <div style={{ background: '#111', padding: '12px', borderRadius: '4px' }}>
                    <div style={{ color: '#FFB347', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px' }}>POST /partner/v1/agents/&#123;agent_id&#125;/executed</div>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>Callback endpoint for partners to report successful transaction signing.</div>
                    <CodeBlock 
                      title="Request Body" 
                      code={`{
  "proposal_id": "uuid",
  "status": "signed_submitted",
  "tx_signature": "5xxxxxxxxx",
  "reason": "OK"
}`}
                    />
                  </div>

                  <div style={{ background: '#111', padding: '12px', borderRadius: '4px' }}>
                    <div style={{ color: '#FF6B6B', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px' }}>POST /partner/v1/agents/&#123;agent_id&#125;/kill</div>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>Emergency kill switch to immediately stop receiving new proposals.</div>
                    <div style={{ background: '#000', padding: '8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#888' }}>
                      <span style={{color: '#fff'}}>Note:</span> No payload required. Re-enable with <span style={{color: '#4FC3F7'}}>POST /revive</span>
                    </div>
                  </div>

                  <div style={{ background: '#111', padding: '12px', borderRadius: '4px' }}>
                    <div style={{ color: '#00C896', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px' }}>POST /partner/v1/agents/&#123;agent_id&#125;/revive</div>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>Restores the agent's signal keran after a kill switch event.</div>
                    <div style={{ background: '#000', padding: '8px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#888' }}>
                      <span style={{color: '#fff'}}>Note:</span> No payload required. Status will return to active.
                    </div>
                  </div>

                  <div style={{ background: '#111', padding: '12px', borderRadius: '4px' }}>
                    <div style={{ color: '#CE93D8', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", marginBottom: '8px' }}>GET /partner/v1/agents/&#123;agent_id&#125;/status</div>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>Check the agent's current health status, uptime, and configured caps.</div>
                    <CodeBlock 
                      title="Response (Success)" 
                      code={`{
  "agent_id": "7764bdd9...",
  "is_killed": false,
  "caps": {
    "max_trade_bps": 50,
    "max_daily_loss_bps": 300,
    "max_open_positions": 2
  },
  "uptime": 3600.5,
  "timestamp": "2026-06-13T12:00:00.000Z"
}`}
                    />
                  </div>

                </div>
              </div>

              <div style={{
                background: 'rgba(255, 179, 71, 0.05)',
                border: '1px solid rgba(255, 179, 71, 0.2)',
                padding: '12px 16px',
                borderRadius: '4px',
                color: '#FFB347',
                fontSize: '11px',
              }}>
                <strong>Note:</strong> All API requests must use the production core URL (e.g. <code>https://&lt;YOUR_CORE_URL&gt;</code>) and your specific <code>agent_id</code>. Dummy data must not be used in production.
              </div>
            </div>
          </StepSection>
        </div>

        {/* Divider */}
        <div style={{ margin: '48px 0', borderBottom: '1px solid #1a1a24' }} />

        {/* FAQ Section */}
        <div>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '24px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#fff',
            marginBottom: '16px',
          }}>
            Frequently Asked Questions
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <FaqItem
              question="How much $AUTR do I need to hold?"
              answer="You must hold at least 10,000,000 $AUTR tokens. This represents 1% of the 1,000,000,000 (1 billion) total supply."
              isOpen={openFaqs.has(0)}
              onToggle={() => toggleFaq(0)}
            />
            <FaqItem
              question="What if I sell some and go below 1%?"
              answer="Access is revoked automatically via our Supabase integration checks. Re-buying above the 10M token threshold grants access back automatically on the next check."
              isOpen={openFaqs.has(1)}
              onToggle={() => toggleFaq(1)}
            />
            <FaqItem
              question="Do I need to know how to code?"
              answer="No. The pre-deployed dashboard features, consciousness feeds, and the HTTP JSON signal API require zero coding skills. Simply copy-paste parameters. Running a private local node, however, requires basic shell/terminal familiarity."
              isOpen={openFaqs.has(2)}
              onToggle={() => toggleFaq(2)}
            />
            <FaqItem
              question="Is the signal API free for holders?"
              answer="Yes. The endpoints are entirely free and unlimited for verified holders."
              isOpen={openFaqs.has(3)}
              onToggle={() => toggleFaq(3)}
            />
            <FaqItem
              question="Can I use the signals for my own trading bot?"
              answer="Yes, absolutely. The JSON signal array returned contains raw coin data, market capitalization numbers, and indicators, allowing you to feed it directly to custom automation pipelines."
              isOpen={openFaqs.has(4)}
              onToggle={() => toggleFaq(4)}
            />
            <FaqItem
              question="What chains does the agent support?"
              answer="The agent fully supports Solana (active) and Base chain (code built and pending deployment)."
              isOpen={openFaqs.has(5)}
              onToggle={() => toggleFaq(5)}
            />
            <FaqItem
              question="How do I get my API key?"
              answer="Join the private verified Telegram group after token validation. API keys are generated and distributed to verified holders directly within the group channel."
              isOpen={openFaqs.has(6)}
              onToggle={() => toggleFaq(6)}
            />
            <FaqItem
              question="Is the agent profitable?"
              answer="The agent's win rate has climbed from negative to 20% in its first week as the Grok learning loop builds trade-rule models. Performance analytics are visible live on-chain."
              isOpen={openFaqs.has(7)}
              onToggle={() => toggleFaq(7)}
            />
            <FaqItem
              question="What is the fee structure for deploying agents?"
              answer="Users pay SOL to deploy agents via Trenchyard. Deploy fees vary by breed tier: Tier 1 (0.025 SOL), Tier 2 (0.05 SOL), Tier 3 (0.1 SOL), and Commander (0.2 SOL)."
              isOpen={openFaqs.has(8)}
              onToggle={() => toggleFaq(8)}
            />
            <FaqItem
              question="What happens to the deploy fees? ($AUTR Burn Mechanics)"
              answer="We use a deflationary fee split mechanism: 50% goes to a holder reward pool, 25% is used to auto-buyback and burn $AUTR, and 25% funds the agent treasury. The auto-burn cycles run automatically every 6 hours."
              isOpen={openFaqs.has(9)}
              onToggle={() => toggleFaq(9)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
