'use client';

import Link from 'next/link';
import { useState, useCallback } from 'react';
import { usePlatform } from '@/hooks/usePlatform';
import { PlatformHeader } from './PlatformHeader';
import { PlatformSidebar } from './PlatformSidebar';
import { PlatformGraph } from './PlatformGraph';
import { PlatformLogStrip } from './PlatformLogStrip';
import { PlatformPositions } from './PlatformPositions';
import { PlatformHistory } from './PlatformHistory';
import { ConsciousnessStream } from './ConsciousnessStream';
import { Trenchyard } from './Trenchyard';
import { AgentProfileCard } from './AgentProfileCard';
import { Kennel } from './Kennel';
import { Marketplace } from './Marketplace';
import { Modal } from '@/components/ui/Modal';
import { NODES, NODE_FULL, AGENT_DATA } from '@/constants/agents';
import { LC } from '@/constants/layers';
import { BREEDS } from '@/constants/breeds';
import { DNA_TRAIT_LABELS, DNA_TRAIT_COLORS } from '@/constants/breeds';
import type { AgentDna } from '@/types';

type MainView = 'graph' | 'consciousness' | 'trenchyard' | 'kennel' | 'marketplace';

// All 11 DNA traits for the detail modal
const ALL_TRAITS: (keyof AgentDna)[] = [
  'speed', 'aggression', 'rug_defense',
  'wallet_intelligence', 'momentum_sensitivity', 'social_signal_weight',
  'liquidity_sensitivity', 'exit_discipline', 'stealth',
  'mutation_rate', 'survival_score',
];

interface PlatformViewProps {
  onClose: () => void;
}


export function PlatformView({ onClose }: PlatformViewProps) {
  const { metrics, statuses, logs } = usePlatform();
  const [agentModalId, setAgentModalId] = useState<string | null>(null);
  const [selectedDnaAgent, setSelectedDnaAgent] = useState<AgentDna | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [logHeight, setLogHeight] = useState(120);
  const [activeChain, setActiveChain] = useState('solana');
  const [mainView, setMainView] = useState<MainView>('graph');

  const startSidebarDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      setSidebarWidth(Math.max(150, Math.min(800, startW + deltaX)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  const startLogDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = logHeight;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      setLogHeight(Math.max(60, Math.min(800, startH + deltaY)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [logHeight]);

  const openAgent = useCallback((id: string) => {
    setAgentModalId(id);
  }, []);

  const closeAgentModal = useCallback(() => {
    setAgentModalId(null);
  }, []);

  const openDnaAgent = useCallback((agent: AgentDna) => {
    setSelectedDnaAgent(agent);
  }, []);

  const closeDnaAgentModal = useCallback(() => {
    setSelectedDnaAgent(null);
  }, []);

  // Build agent modal content
  const agentModalContent = (() => {
    if (!agentModalId) return null;
    const n = NODES.find(x => x.id === agentModalId);
    const d = AGENT_DATA[agentModalId];
    if (!n || !d) return null;
    const lc = LC[n.layer];

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{
            background: lc.fill, color: lc.text,
            fontFamily: "'Barlow Condensed',sans-serif", fontSize: '9px', fontWeight: 700,
            letterSpacing: '.14em', textTransform: 'uppercase', padding: '4px 10px',
          }}>
            {n.layer}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', color: '#999' }}>
            r={n.r}px
          </span>
        </div>
        <p>{d.role}</p>
        <div className="modal-sec-label">Receives from</div>
        {d.connects_from.length > 0 ? d.connects_from.map(f => {
          const fn = NODES.find(x => x.id === f);
          const flc = LC[fn?.layer || 'core'];
          return (
            <div key={f} className="modal-kv">
              <span className="modal-k">{f}</span>
              <span className="modal-v" style={{ color: flc.stroke }}>{NODE_FULL[f] || f}</span>
            </div>
          );
        }) : <div className="modal-kv"><span className="modal-k">—</span></div>}
        <div className="modal-sec-label">Sends to</div>
        {d.connects_to.length > 0 ? d.connects_to.map(t => {
          const tn = NODES.find(x => x.id === t);
          const tlc = LC[tn?.layer || 'core'];
          return (
            <div key={t} className="modal-kv">
              <span className="modal-k">{t}</span>
              <span className="modal-v" style={{ color: tlc.stroke }}>{NODE_FULL[t] || t}</span>
            </div>
          );
        }) : <div className="modal-kv"><span className="modal-k">—</span></div>}
      </>
    );
  })();

  return (
    <>
      <div className="pv-root" style={{ gridTemplateRows: `48px 1fr ${mainView === 'graph' ? logHeight : 0}px` }}>
        <PlatformHeader metrics={metrics} onClosePlatform={onClose} activeChain={activeChain} setActiveChain={setActiveChain} />
        
        {/* Horizontal Drag Handle for Log Strip */}
        {mainView === 'graph' && (
          <div 
            style={{ position: 'absolute', bottom: logHeight - 3, left: 0, right: 0, height: '6px', cursor: 'ns-resize', zIndex: 50 }} 
            onMouseDown={startLogDrag} 
          />
        )}

        <div className="pv-main" style={{ gridTemplateColumns: `1fr ${mainView === 'graph' ? sidebarWidth : 0}px`, position: 'relative' }}>
          {/* View toggle tabs */}
          <div style={{
            position: 'absolute', top: 0, left: 0, zIndex: 20,
            display: 'flex', gap: '1px',
          }}>
            {(['graph', 'consciousness', 'trenchyard', 'kennel', 'marketplace'] as MainView[]).map(view => {
              const tabColors: Record<MainView, string> = {
                graph: '#4FC3F7',
                consciousness: '#00C896',
                trenchyard: '#FFB347',
                kennel: '#CE93D8',
                marketplace: '#FF8A65',
              };
              const tabLabels: Record<MainView, React.ReactNode> = {
                graph: 'Agent Graph',
                consciousness: '⬡ Consciousness',
                trenchyard: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '-1px' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    Trenchyard
                  </span>
                ),
                kennel: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '-1px' }}>
                      <path d="M6 3h12" />
                      <path d="M10 3v6l-4 8a2 2 0 0 0 1.7 3h8.6a2 2 0 0 0 1.7-3l-4-8V3z" />
                    </svg>
                    Kennel
                  </span>
                ),
                marketplace: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '-1px' }}>
                      <circle cx="9" cy="21" r="1" />
                      <circle cx="20" cy="21" r="1" />
                      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                    </svg>
                    DNA Market
                  </span>
                ),
              };
              return (
                <button
                  key={view}
                  id={`pv-tab-${view}`}
                  onClick={() => setMainView(view)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '9px',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                    background: mainView === view ? '#1a1a2e' : 'transparent',
                    color: mainView === view ? tabColors[view] : '#444',
                    borderBottom: mainView === view
                      ? `2px solid ${tabColors[view]}`
                      : '2px solid transparent',
                    transition: 'color .15s, border-color .15s',
                  }}
                >
                  {tabLabels[view]}
                </button>
              );
            })}
          </div>

          {/* Main panel: Graph, Consciousness Feed, or Trenchyard */}
          {mainView === 'graph' && (
            <>
              <PlatformPositions metrics={metrics} logHeight={logHeight} />
              <PlatformHistory metrics={metrics} rightOffset={sidebarWidth + 16} logHeight={logHeight} />
              <PlatformGraph statuses={statuses} onOpenAgent={openAgent} />
            </>
          )}
          {mainView === 'consciousness' && (
            <div style={{
              position: 'absolute',
              top: 28, left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden',
              borderRight: '1px solid #1a1a24',
            }}>
              <ConsciousnessStream />
            </div>
          )}
          {mainView === 'trenchyard' && (
            <div style={{
              position: 'absolute',
              top: 28, left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden',
              borderRight: '1px solid #1a1a24',
            }}>
              <Trenchyard onSelectAgent={openDnaAgent} />
            </div>
          )}
          {mainView === 'kennel' && (
            <div style={{
              position: 'absolute',
              top: 28, left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden',
              borderRight: '1px solid #1a1a24',
            }}>
              <Kennel />
            </div>
          )}
          {mainView === 'marketplace' && (
            <div style={{
              position: 'absolute',
              top: 28, left: 0,
              right: 0,
              bottom: 0,
              overflow: 'hidden',
              borderRight: '1px solid #1a1a24',
            }}>
              <Marketplace />
            </div>
          )}
          
          {mainView === 'graph' && (
            <>
              {/* Vertical Drag Handle for Sidebar */}
              <div 
                style={{ position: 'absolute', right: sidebarWidth - 3, top: 48, bottom: logHeight, width: '6px', cursor: 'ew-resize', zIndex: 50 }} 
                onMouseDown={startSidebarDrag} 
              />

              <PlatformSidebar statuses={statuses} onOpenAgent={openAgent} />
            </>
          )}
        </div>
        {mainView === 'graph' && <PlatformLogStrip logs={logs} />}
      </div>

      {/* Agent Detail Modal (graph nodes) */}
      <Modal
        id="agent-modal"
        isOpen={!!agentModalId}
        onClose={closeAgentModal}
        title={agentModalId ? (NODE_FULL[agentModalId] || agentModalId.toUpperCase()) : ''}
      >
        {agentModalContent}
      </Modal>

      {/* Agent DNA Detail Modal (trenchyard cards) */}
      <Modal
        id="dna-agent-modal"
        isOpen={!!selectedDnaAgent}
        onClose={closeDnaAgentModal}
        title={selectedDnaAgent?.name || ''}
      >
        {selectedDnaAgent && (() => {
          const breed = BREEDS[selectedDnaAgent.breed as keyof typeof BREEDS];
          const pnlPositive = selectedDnaAgent.total_pnl_sol >= 0;
          const winRatePct = Math.round(selectedDnaAgent.win_rate * 100);
          const genLabel = selectedDnaAgent.generation === 0 ? 'Genesis' : `Gen ${selectedDnaAgent.generation}`;

          return (
            <>
              {/* Breed + generation badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '24px' }}>
                  {breed?.icon || (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 7v4" />
                      <line x1="8" y1="16" x2="8.01" y2="16" />
                      <line x1="16" y1="16" x2="16.01" y2="16" />
                    </svg>
                  )}
                </span>
                <span style={{
                  fontSize: '9px',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: breed?.color || '#888',
                  background: `${breed?.color || '#888'}18`,
                  padding: '2px 8px',
                  borderRadius: '2px',
                  border: `1px solid ${breed?.color || '#888'}40`,
                }}>
                  {breed?.name || selectedDnaAgent.breed}
                </span>
                <span style={{
                  fontSize: '9px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#555',
                  padding: '2px 6px',
                  border: '1px solid #222',
                  borderRadius: '2px',
                }}>
                  {genLabel}
                </span>
              </div>

              {/* Description */}
              {breed && (
                <p style={{
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#777',
                  marginBottom: '16px',
                  lineHeight: 1.5,
                }}>
                  {breed.description}
                </p>
              )}

              {/* Performance stats */}
              <div className="modal-sec-label">Performance</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '16px' }}>
                {[
                  { label: 'Trades', value: String(selectedDnaAgent.total_trades), color: '#aaa' },
                  { label: 'Win Rate', value: selectedDnaAgent.total_trades > 0 ? `${winRatePct}%` : '—', color: winRatePct >= 50 ? '#00C896' : winRatePct > 0 ? '#FFB347' : '#555' },
                  { label: 'PnL (SOL)', value: selectedDnaAgent.total_trades > 0 ? `${pnlPositive ? '+' : ''}${selectedDnaAgent.total_pnl_sol.toFixed(3)}` : '—', color: pnlPositive ? '#00C896' : '#FF6B6B' },
                  { label: 'Max Drawdown', value: `${selectedDnaAgent.max_drawdown.toFixed(1)}%`, color: '#FF6B6B' },
                  { label: 'Avg Hold', value: `${selectedDnaAgent.avg_hold_min.toFixed(0)}m`, color: '#aaa' },
                  { label: 'Rug Survival', value: `${Math.round(selectedDnaAgent.rug_survival_rate * 100)}%`, color: '#81C784' },
                ].map(s => (
                  <div key={s.label} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '6px 4px',
                    background: '#0d0d12',
                    borderRadius: '4px',
                    border: '1px solid #1a1a28',
                  }}>
                    <span style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: s.color, fontWeight: 700 }}>
                      {s.value}
                    </span>
                    <span style={{ fontSize: '8px', color: '#444', marginTop: '2px' }}>{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Full DNA traits */}
              <div className="modal-sec-label">DNA Traits</div>
              <div style={{ marginBottom: '12px' }}>
                {ALL_TRAITS.map(trait => {
                  const value = selectedDnaAgent[trait] as number;
                  const color = DNA_TRAIT_COLORS[trait] || '#555';
                  return (
                    <div key={trait} style={{ marginBottom: '5px' }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        marginBottom: '2px',
                        fontSize: '9px', fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        <span style={{ color: '#666' }}>{DNA_TRAIT_LABELS[trait] || trait}</span>
                        <span style={{ color: '#aaa' }}>{value}</span>
                      </div>
                      <div style={{
                        height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${value}%`,
                          background: color,
                          borderRadius: '2px',
                          transition: 'width .6s ease',
                          boxShadow: `0 0 6px ${color}60`,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lineage */}
              {(selectedDnaAgent.parent_a || selectedDnaAgent.parent_b) && (
                <>
                  <div className="modal-sec-label">Lineage</div>
                  <div className="modal-kv">
                    <span className="modal-k">Parent A</span>
                    <span className="modal-v">{selectedDnaAgent.parent_a || '—'}</span>
                  </div>
                  <div className="modal-kv">
                    <span className="modal-k">Parent B</span>
                    <span className="modal-v">{selectedDnaAgent.parent_b || '—'}</span>
                  </div>
                </>
              )}

              {/* ID */}
              <div style={{ marginTop: '12px', fontSize: '8px', fontFamily: "'JetBrains Mono', monospace", color: '#333' }}>
                ID: {selectedDnaAgent.id}
              </div>

              {/* Link to public profile */}
              <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <Link href={`/agent/${selectedDnaAgent.id}`} style={{
                  display: 'inline-block',
                  width: '100%',
                  padding: '12px',
                  background: `${breed?.color || '#00C896'}15`,
                  color: breed?.color || '#00C896',
                  border: `1px solid ${breed?.color || '#00C896'}40`,
                  borderRadius: '4px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = `${breed?.color || '#00C896'}25`;
                  (e.currentTarget as HTMLElement).style.borderColor = `${breed?.color || '#00C896'}80`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = `${breed?.color || '#00C896'}15`;
                  (e.currentTarget as HTMLElement).style.borderColor = `${breed?.color || '#00C896'}40`;
                }}
                >
                  View Public Profile
                </Link>
              </div>
            </>
          );
        })()}
      </Modal>
    </>
  );
}
