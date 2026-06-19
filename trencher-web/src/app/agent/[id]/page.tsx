'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAgentDna } from '@/hooks/useAgentDna';
import { AgentProfileCard } from '@/components/platform/AgentProfileCard';
import { ConsciousnessStream } from '@/components/platform/ConsciousnessStream';
import { AgentTradingHistory } from '@/components/platform/AgentTradingHistory';
import { BREEDS } from '@/constants/breeds';

export default function AgentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [isCopied, setIsCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { agents, connected, isLoaded } = useAgentDna();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const agent = agents.find(a => a.id === id || a.id.startsWith(id));

  // Filter stream by the specific agent's ID so we only see its actual thoughts
  let strategyFilter: string | undefined = undefined;
  if (agent) {
    strategyFilter = agent.id;
  }

  const fetchBalance = useCallback(async () => {
    if (!agent?.agent_wallet) return;
    setIsRefreshing(true);
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [agent.agent_wallet]
        })
      });
      const data = await response.json();
      if (data.result !== undefined) {
        setBalance(data.result.value / 1e9);
      }
    } catch (err) {
      console.error("Failed to fetch balance", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [agent?.agent_wallet]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // ─── Withdraw Modal State ───────────────────────────────────────────────────
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawSecret, setWithdrawSecret] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{
    type: 'success' | 'error';
    message: string;
    signature?: string;
    amountSol?: number;
  } | null>(null);

  const handleWithdraw = async () => {
    if (!agent?.id || !withdrawAddress.trim() || !withdrawSecret.trim()) return;
    setWithdrawLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
      const amountNum = withdrawAmount.trim() ? parseFloat(withdrawAmount) : undefined;
      const res = await fetch(`${API_URL}/api/agent/${agent.id}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-key': withdrawSecret.trim(),
        },
        body: JSON.stringify({
          destinationAddress: withdrawAddress.trim(),
          amountSol: amountNum
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWithdrawResult({
          type: 'success',
          message: `Successfully withdrew ${data.amountSol?.toFixed(6)} SOL`,
          signature: data.signature,
          amountSol: data.amountSol,
        });
        // Refresh balance
        setTimeout(() => fetchBalance(), 2000);
      } else {
        setWithdrawResult({
          type: 'error',
          message: data.error || 'Withdrawal failed. Please check your inputs.',
        });
      }
    } catch (err: any) {
      setWithdrawResult({
        type: 'error',
        message: err.message || 'Network error. Please try again.',
      });
    } finally {
      setWithdrawLoading(false);
    }
  };

  const closeWithdrawModal = () => {
    setShowWithdrawModal(false);
    setWithdrawAddress('');
    setWithdrawAmount('');
    setWithdrawSecret('');
    setWithdrawResult(null);
    setWithdrawLoading(false);
  };
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050508' }}>
      {/* Reusing Nav or Custom Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1a1a24',
        display: 'flex',
        alignItems: 'center',
        gap: '24px'
      }}>
        <button
          className="pv-back"
          style={{ marginRight: 0 }}
          onClick={() => router.push('/?platform=true')}
        >
          ← BACK
        </button>
        <div
          onClick={() => router.push('/')}
          style={{
            color: '#00C896',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            cursor: 'pointer'
          }}
        >
          TRENCHER AGENT
        </div>
        <div style={{
          fontSize: '12px',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#888',
          marginLeft: 'auto'
        }}>
          PUBLIC PROFILE
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Column: DNA Profile */}
        <div style={{
          width: '380px',
          borderRight: '1px solid #1a1a24',
          padding: '24px',
          overflowY: 'auto'
        }}>
          {!isLoaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', textAlign: 'center' }}>
              <div
                className="animate-spin"
                style={{
                  width: '30px', height: '30px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#00C896', borderRadius: '50%', marginBottom: '12px'
                }}
              />
              <div style={{ color: '#888', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}>
                LOADING PROFILE...
              </div>
            </div>
          ) : !connected && agents.length === 0 ? (
            <div style={{ color: '#555', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
              Connecting to agent network...
            </div>
          ) : !agent ? (
            <div style={{ color: '#FF6B6B', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
              Agent DNA not found for ID: {id}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ fontSize: '11px', color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>
                DNA Hash: {agent.id}
              </div>

              <AgentProfileCard agent={agent} compact={false} hideViewProfile={true} />

              <div style={{ background: '#0a0a0f', padding: '16px', borderRadius: '6px', border: '1px solid #1a1a24' }}>
                <div style={{ color: '#00C896', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 'bold' }}>
                  Lineage
                </div>
                <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#ccc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Generation</span>
                    <span>{agent.generation === 0 ? 'Genesis' : `Gen ${agent.generation}`}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Parent A</span>
                    <span>{agent.parent_a ? agent.parent_a.slice(0, 8) : 'None'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Parent B</span>
                    <span>{agent.parent_b ? agent.parent_b.slice(0, 8) : 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Social Scout: TG Groups Panel */}
              {agent.breed === 'social_scout' && (() => {
                let dnaConfig: any = {};
                try { dnaConfig = JSON.parse(agent.dna_config || '{}'); } catch { }
                const groups: string[] = dnaConfig.tgGroups || [];
                return (
                  <div style={{ background: '#0a0a0f', padding: '16px', borderRadius: '6px', border: '1px solid rgba(0,187,249,0.25)' }}>
                    <div style={{ color: '#00BBF9', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>📡 TG Alpha Groups</span>
                      <span style={{ fontSize: '8px', background: 'rgba(0,187,249,0.1)', padding: '2px 6px', borderRadius: '4px', color: '#00BBF9' }}>
                        {groups.length} CONFIGURED
                      </span>
                    </div>
                    {groups.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#555', fontFamily: "'JetBrains Mono', monospace", fontStyle: 'italic' }}>
                        No TG groups configured. Set TG_ALPHA_GROUPS in your .env file.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {groups.map((g: string) => (
                          <div key={g} style={{
                            background: 'rgba(0,187,249,0.05)',
                            border: '1px solid rgba(0,187,249,0.15)',
                            borderRadius: '4px',
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontFamily: "'JetBrains Mono', monospace",
                            color: '#00BBF9',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <span>{g}</span>
                            <span style={{ fontSize: '9px', color: '#555' }}>ACTIVE</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: '12px', fontSize: '9px', color: '#555', lineHeight: '1.6', borderTop: '1px solid #1a1a28', paddingTop: '10px' }}>
                      Groups with &lt;35% win rate after 20 trades are auto-demoted.
                      Rate limit: {dnaConfig.tg_max_trades_per_group_hour || 5} trades/group/hour.
                    </div>
                  </div>
                );
              })()}

              {agent.agent_wallet && (
                <div style={{ background: '#0a0a0f', padding: '16px', borderRadius: '6px', border: '1px dashed #00C89640' }}>
                  <div style={{ color: '#00C896', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Agent Wallet</span>
                    <span style={{ fontSize: '8px', background: 'rgba(0,200,150,0.1)', padding: '2px 6px', borderRadius: '4px' }}>FUNDING ADDRESS</span>

                  </div>
                  <div
                    onClick={() => {
                      if (agent.agent_wallet) handleCopy(agent.agent_wallet);
                    }}
                    style={{
                      fontSize: '11px',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#ddd',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid #1a1a24',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, background-color 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#00C896'; e.currentTarget.style.background = 'rgba(0,200,150,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a24'; e.currentTarget.style.background = 'rgba(0,0,0,0.3)'; }}
                    title="Click to copy wallet address"
                  >
                    <span style={{ wordBreak: 'break-all' }}>{agent.agent_wallet}</span>
                    {isCopied ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00C896" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#00C896' }}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </div>
                  <div style={{ fontSize: '9px', color: '#666', marginTop: '8px', fontFamily: "'JetBrains Mono', monospace" }}>
                    Transfer SOL to this address to start automatic Live Trading.
                  </div>
                  {balance !== null && (
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '12px',
                      borderTop: '1px solid #1a1a24',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '10px', color: '#888', fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Current Balance
                        <button
                          onClick={fetchBalance}
                          disabled={isRefreshing}
                          style={{
                            background: 'rgba(0, 200, 150, 0.1)',
                            border: '1px solid rgba(0, 200, 150, 0.2)',
                            borderRadius: '4px',
                            cursor: isRefreshing ? 'default' : 'pointer',
                            padding: '3px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            color: isRefreshing ? '#555' : '#00C896',
                            transition: 'all 0.2s',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '8px',
                            textTransform: 'uppercase'
                          }}
                          onMouseEnter={e => { if (!isRefreshing) { e.currentTarget.style.background = 'rgba(0, 200, 150, 0.2)'; e.currentTarget.style.borderColor = 'rgba(0, 200, 150, 0.4)'; } }}
                          onMouseLeave={e => { if (!isRefreshing) { e.currentTarget.style.background = 'rgba(0, 200, 150, 0.1)'; e.currentTarget.style.borderColor = 'rgba(0, 200, 150, 0.2)'; } }}
                          title="Refresh balance"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isRefreshing ? 'animate-spin' : ''}>
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <polyline points="1 20 1 14 7 14"></polyline>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                          </svg>
                          {isRefreshing ? 'REFRESHING...' : 'REFRESH'}
                        </button>
                      </span>
                      <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>{balance.toFixed(4)} SOL</span>
                    </div>
                  )}

                  {/* Withdraw Button — only shown when balance > 0 */}
                  {balance !== null && balance > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <button
                        id="withdraw-btn"
                        onClick={() => setShowWithdrawModal(true)}
                        style={{
                          width: '100%',
                          padding: '9px 0',
                          background: 'linear-gradient(135deg, rgba(255,100,60,0.15) 0%, rgba(255,60,100,0.1) 100%)',
                          border: '1px solid rgba(255,100,60,0.35)',
                          borderRadius: '5px',
                          color: '#FF6B3D',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '10px',
                          fontWeight: 'bold',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,100,60,0.28) 0%, rgba(255,60,100,0.2) 100%)';
                          e.currentTarget.style.borderColor = 'rgba(255,100,60,0.6)';
                          e.currentTarget.style.boxShadow = '0 0 12px rgba(255,100,60,0.2)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,100,60,0.15) 0%, rgba(255,60,100,0.1) 100%)';
                          e.currentTarget.style.borderColor = 'rgba(255,100,60,0.35)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                        WITHDRAW
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Right Area: Split into History and Stream */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
          {/* Middle Column: Trading History */}
          <div style={{ flex: 1, borderRight: '1px solid #1a1a24', position: 'relative', overflowY: 'auto', padding: '24px' }}>
            <AgentTradingHistory agentId={id} />
          </div>

          {/* Right Column: Consciousness Stream */}
          <div style={{ flex: 1, position: 'relative' }}>
            <ConsciousnessStream strategyFilter={strategyFilter} />
          </div>
        </div>
      </div>

      {/* ─── Withdraw Modal ─────────────────────────────────────────────────────── */}
      {showWithdrawModal && (
        <div
          id="withdraw-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) closeWithdrawModal(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            id="withdraw-modal"
            style={{
              background: 'linear-gradient(145deg, #0d0d15 0%, #080810 100%)',
              border: '1px solid #1e1e2e',
              borderRadius: '12px',
              padding: '28px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,100,60,0.08)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {/* Result States */}
            {withdrawResult ? (
              withdrawResult.type === 'success' ? (
                /* ── SUCCESS ── */
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: 'rgba(0,200,150,0.12)',
                    border: '2px solid rgba(0,200,150,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00C896" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div style={{ color: '#00C896', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em', marginBottom: '8px' }}>
                    WITHDRAWAL SUCCESSFUL
                  </div>
                  <div style={{ color: '#aaa', fontSize: '11px', marginBottom: '20px', lineHeight: 1.6 }}>
                    {withdrawResult.message}
                  </div>
                  {withdrawResult.signature && (
                    <div style={{
                      background: 'rgba(0,200,150,0.06)',
                      border: '1px solid rgba(0,200,150,0.15)',
                      borderRadius: '6px',
                      padding: '10px',
                      marginBottom: '20px',
                    }}>
                      <div style={{ fontSize: '9px', color: '#666', marginBottom: '4px', letterSpacing: '0.08em' }}>TRANSACTION SIGNATURE</div>
                      <div
                        style={{ fontSize: '10px', color: '#00C896', wordBreak: 'break-all', cursor: 'pointer' }}
                        onClick={() => window.open(`https://solscan.io/tx/${withdrawResult.signature}`, '_blank')}
                        title="View on Solscan"
                      >
                        {withdrawResult.signature}
                      </div>
                      <div style={{ fontSize: '9px', color: '#555', marginTop: '6px' }}>Click to view on Solscan ↗</div>
                    </div>
                  )}
                  <button
                    id="withdraw-success-close"
                    onClick={closeWithdrawModal}
                    style={{
                      width: '100%', padding: '10px',
                      background: 'rgba(0,200,150,0.12)',
                      border: '1px solid rgba(0,200,150,0.3)',
                      borderRadius: '6px', color: '#00C896',
                      fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.1em',
                      cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    CLOSE
                  </button>
                </div>
              ) : (
                /* ── FAILED ── */
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: 'rgba(255,80,80,0.1)',
                    border: '2px solid rgba(255,80,80,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FF5050" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <div style={{ color: '#FF5050', fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em', marginBottom: '8px' }}>
                    WITHDRAWAL FAILED
                  </div>
                  <div style={{
                    background: 'rgba(255,80,80,0.06)',
                    border: '1px solid rgba(255,80,80,0.15)',
                    borderRadius: '6px', padding: '12px',
                    fontSize: '11px', color: '#FF6B6B',
                    marginBottom: '20px', lineHeight: 1.6, textAlign: 'left',
                  }}>
                    {withdrawResult.message}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      id="withdraw-fail-retry"
                      onClick={() => setWithdrawResult(null)}
                      style={{
                        flex: 1, padding: '10px',
                        background: 'rgba(255,100,60,0.12)',
                        border: '1px solid rgba(255,100,60,0.3)',
                        borderRadius: '6px', color: '#FF6B3D',
                        fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.1em',
                        cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      TRY AGAIN
                    </button>
                    <button
                      id="withdraw-fail-close"
                      onClick={closeWithdrawModal}
                      style={{
                        flex: 1, padding: '10px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid #1e1e2e',
                        borderRadius: '6px', color: '#666',
                        fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.1em',
                        cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      CLOSE
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* ── FORM ── */
              <>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div>
                    <div style={{ color: '#FF6B3D', fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19V5M5 12l7-7 7 7" />
                      </svg>
                      WITHDRAW FUNDS
                    </div>
                    <div style={{ fontSize: '9px', color: '#555', marginTop: '4px', letterSpacing: '0.05em' }}>
                      Withdraw all SOL from agent wallet
                    </div>
                  </div>
                  <button
                    onClick={closeWithdrawModal}
                    style={{
                      background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                {/* Balance Info */}
                {balance !== null && (
                  <div style={{
                    background: 'rgba(255,100,60,0.06)',
                    border: '1px solid rgba(255,100,60,0.15)',
                    borderRadius: '8px', padding: '12px 14px',
                    marginBottom: '18px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '10px', color: '#888' }}>Available Balance</span>
                    <span style={{ fontSize: '14px', color: '#FF6B3D', fontWeight: 'bold' }}>{balance.toFixed(4)} SOL</span>
                  </div>
                )}

                {/* Destination Address */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '9px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Destination Wallet Address
                  </label>
                  <input
                    id="withdraw-destination"
                    type="text"
                    value={withdrawAddress}
                    onChange={e => setWithdrawAddress(e.target.value)}
                    placeholder="Enter Solana wallet address..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid #1e1e2e',
                      borderRadius: '6px',
                      color: '#ddd',
                      fontSize: '11px',
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#FF6B3D'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#1e1e2e'; }}
                  />
                </div>

                {/* Withdraw Amount */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '9px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Amount (SOL) — Leave empty for MAX
                  </label>
                  <input
                    id="withdraw-amount"
                    type="number"
                    step="any"
                    min="0"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="e.g. 0.5"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid #1e1e2e',
                      borderRadius: '6px',
                      color: '#ddd',
                      fontSize: '11px',
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#FF6B3D'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#1e1e2e'; }}
                  />
                  {balance !== null && balance > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      {[25, 50, 75, 100].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            let amountNum = balance * (pct / 100);
                            if (pct === 100) {
                              amountNum = Math.max(0, amountNum - 0.000005);
                            }
                            // Calculate to 6 decimal places (safe for Solana, avoids rounding to 0 for small balances)
                            const amount = (Math.floor(amountNum * 1e6) / 1e6).toString();
                            setWithdrawAmount(amount);
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 0',
                            background: '#1e1e2e',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            color: '#FF6B3D',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            fontFamily: "'JetBrains Mono', monospace",
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#2a2a3a'; e.currentTarget.style.borderColor = '#FF6B3D'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#1e1e2e'; e.currentTarget.style.borderColor = '#333'; }}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Agent Secret Key */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '9px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                    Agent Secret Key <span style={{ color: '#FF5050' }}>*</span>
                  </label>
                  <input
                    id="withdraw-secret"
                    type="password"
                    value={withdrawSecret}
                    onChange={e => setWithdrawSecret(e.target.value)}
                    placeholder="Enter agent secret key to confirm..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid #1e1e2e',
                      borderRadius: '6px',
                      color: '#ddd',
                      fontSize: '11px',
                      fontFamily: "'JetBrains Mono', monospace",
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#FF6B3D'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#1e1e2e'; }}
                    onKeyDown={e => { if (e.key === 'Enter' && withdrawAddress && withdrawSecret && !withdrawLoading) handleWithdraw(); }}
                  />
                  <div style={{ fontSize: '9px', color: '#555', marginTop: '5px' }}>
                    Your agent secret key is required to authorize this transaction.
                  </div>
                </div>

                {/* Warning */}
                <div style={{
                  background: 'rgba(255,200,0,0.05)',
                  border: '1px solid rgba(255,200,0,0.12)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '18px',
                  display: 'flex', gap: '8px', alignItems: 'flex-start',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFC800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span style={{ fontSize: '9px', color: '#AA8800', lineHeight: 1.6 }}>
                    This will withdraw the specified amount (or entire balance if empty) minus network fees. This action cannot be undone.
                  </span>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={closeWithdrawModal}
                    style={{
                      flex: 1, padding: '11px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid #1e1e2e',
                      borderRadius: '6px', color: '#666',
                      fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.1em',
                      cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    id="withdraw-confirm-btn"
                    onClick={handleWithdraw}
                    disabled={!withdrawAddress.trim() || !withdrawSecret.trim() || withdrawLoading}
                    style={{
                      flex: 2, padding: '11px',
                      background: (!withdrawAddress.trim() || !withdrawSecret.trim() || withdrawLoading)
                        ? 'rgba(255,100,60,0.06)'
                        : 'linear-gradient(135deg, rgba(255,100,60,0.25) 0%, rgba(255,60,100,0.18) 100%)',
                      border: '1px solid rgba(255,100,60,0.35)',
                      borderRadius: '6px',
                      color: (!withdrawAddress.trim() || !withdrawSecret.trim() || withdrawLoading) ? '#555' : '#FF6B3D',
                      fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.1em',
                      cursor: (!withdrawAddress.trim() || !withdrawSecret.trim() || withdrawLoading) ? 'not-allowed' : 'pointer',
                      fontFamily: "'JetBrains Mono', monospace",
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      transition: 'all 0.2s',
                    }}
                  >
                    {withdrawLoading ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                          <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        PROCESSING...
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                        CONFIRM WITHDRAW
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* ──────────────────────────────────────────────────────────────────────── */}
    </div>
  );
}
