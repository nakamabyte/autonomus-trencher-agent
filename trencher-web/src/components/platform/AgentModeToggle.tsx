'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import type { AgentDna } from '@/types';
import { Modal } from '@/components/ui/Modal';

interface AgentModeToggleProps {
  agent: AgentDna;
}

interface GateDetails {
  ok: boolean;
  wallet_balance_sol: number;
  dry_run_trades: number;
  wallet_address?: string;
  reason?: string;
  warning?: string;
}

export function AgentModeToggle({ agent }: AgentModeToggleProps) {
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState<'none' | 'confirm_live' | 'confirm_dry' | 'gate_failed' | 'error' | 'success'>('none');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isAuthError, setIsAuthError] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<'none' | 'toggle' | 'dry_run' | 'live'>('none');
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [gateDetails, setGateDetails] = useState<GateDetails | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isLive = agent.execution_mode === 'live';

  const getHeaders = (baseHeaders: Record<string, string> = {}, extraKey?: string) => {
    const headers = { ...baseHeaders };
    if (extraKey) {
      headers['x-client-key'] = extraKey;
    }
    return headers;
  };

  const handleToggleClick = async (e?: React.MouseEvent) => {
    e?.stopPropagation(); // Avoid card click events
    if (loading) return;

    if (isLive) {
      setModalType('confirm_dry');
      return;
    }

    setLoading(true);
    setIsAuthError(false);
    try {
      const res = await fetch(`/api/core-proxy/agent/${agent.id}/can-go-live`, {
        headers: getHeaders({}, secretKeyInput),
      });
      
      if (res.status === 401) {
        setErrorMsg('Authentication Required: Please enter this agent\'s unique Secret Key.');
        setIsAuthError(true);
        setPendingRetry('toggle');
        setModalType('error');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to verify live trading requirements. Check backend connection.');
      }

      const data = await res.json();
      setGateDetails(data);

      if (!data.ok) {
        setModalType('gate_failed');
      } else {
        setModalType('confirm_live');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred while communicating with the server.');
      setModalType('error');
    } finally {
      setLoading(false);
    }
  };

  const executeModeChange = async (targetMode: 'dry_run' | 'live') => {
    setModalType('none');
    setLoading(true);
    setIsAuthError(false);
    try {
      const res = await fetch(`/api/core-proxy/agent/${agent.id}/set-mode`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }, secretKeyInput),
        body: JSON.stringify({ mode: targetMode }),
      });

      if (res.status === 401) {
        setErrorMsg('Authentication Required: Please enter this agent\'s unique Secret Key.');
        setIsAuthError(true);
        setPendingRetry(targetMode);
        setModalType('error');
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to update agent execution mode.');
      }

      setSuccessMsg(`Agent "${agent.name}" has been successfully switched to ${targetMode.toUpperCase()} mode.`);
      setModalType('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while saving settings.');
      setModalType('error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <>
      <button
        onClick={handleToggleClick}
        disabled={loading}
        style={{
          background: loading
            ? '#222'
            : isLive
            ? 'linear-gradient(135deg, #00C896 0%, #009E74 100%)'
            : 'linear-gradient(135deg, #FFB347 0%, #E0952A 100%)',
          color: loading ? '#666' : '#000',
          padding: '5px 12px',
          borderRadius: '4px',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 'bold',
          fontSize: '11px',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: isLive ? '0 0 10px rgba(0, 200, 150, 0.3)' : '0 0 10px rgba(255, 179, 71, 0.2)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (loading) return;
          (e.currentTarget as HTMLElement).style.opacity = '0.9';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          if (loading) return;
          (e.currentTarget as HTMLElement).style.opacity = '1';
          (e.currentTarget as HTMLElement).style.transform = 'none';
        }}
      >
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: isLive ? '#fff' : 'transparent',
          border: isLive ? 'none' : '1.5px solid #000',
          display: 'inline-block',
        }} />
        {loading ? 'SYNCING...' : isLive ? 'LIVE' : 'DRY RUN'}
      </button>

      <div onClick={(e) => e.stopPropagation()}>
        {/* ── MODAL: CONFIRM GO LIVE ── */}
        <Modal
          id={`modal-confirm-live-${agent.id}`}
          isOpen={modalType === 'confirm_live'}
          onClose={() => setModalType('none')}
          title="Activate Live Mode"
        >
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px', background: 'rgba(255, 179, 71, 0.1)', border: '1px solid rgba(255, 179, 71, 0.3)', color: '#FFB347', borderRadius: '4px', display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <div>
                <strong>Switching {agent.name} to LIVE trading.</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#ccc' }}>
                  This agent will start executing real-time trades with REAL SOL on-chain.
                </p>
              </div>
            </div>

            <div style={{ background: '#0d0d12', border: '1px solid #1a1a28', padding: '12px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Wallet Balance:</span>
                <span style={{ color: '#00C896', fontWeight: 'bold' }}>{gateDetails?.wallet_balance_sol.toFixed(4)} SOL</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Dry Run Trades:</span>
                <span style={{ color: '#aaa' }}>{gateDetails?.dry_run_trades}</span>
              </div>
              {gateDetails?.wallet_address && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed #222' }}>
                  <span style={{ color: '#666', fontSize: '10px' }}>Agent Wallet Address:</span>
                  <div 
                    onClick={() => handleCopy(gateDetails.wallet_address!)}
                    style={{ 
                      color: '#ccc', fontSize: '10px', background: '#000', padding: '6px', borderRadius: '4px', 
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                      border: '1px solid #222', transition: 'border-color 0.2s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#00C896')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#222')}
                    title="Click to copy"
                  >
                    <span style={{ wordBreak: 'break-all' }}>{gateDetails.wallet_address}</span>
                    {isCopied ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00C896" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#00C896' }}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>

            {gateDetails?.warning && (
              <div style={{ padding: '8px 10px', background: 'rgba(240, 80, 80, 0.1)', border: '1px solid rgba(240, 80, 80, 0.3)', color: '#FF8A65', borderRadius: '4px', fontSize: '11px' }}>
                ℹ️ Recommendation: {gateDetails.warning}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={() => executeModeChange('live')}
                style={{
                  flex: 1, padding: '10px', background: '#00C896', border: 'none', borderRadius: '4px',
                  color: '#000', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace"
                }}
              >
                CONFIRM LIVE MODE
              </button>
              <button
                onClick={() => setModalType('none')}
                style={{
                  padding: '10px 16px', background: '#222', border: 'none', borderRadius: '4px',
                  color: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        {/* ── MODAL: CONFIRM DEACTIVATE LIVE ── */}
        <Modal
          id={`modal-confirm-dry-${agent.id}`}
          isOpen={modalType === 'confirm_dry'}
          onClose={() => setModalType('none')}
          title="Switch to Dry Run"
        >
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ color: '#aaa', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to change <strong>{agent.name}</strong> back to DRY RUN mode?
              All active positions will continue to be monitored, but new entries will only be simulated.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                onClick={() => executeModeChange('dry_run')}
                style={{
                  flex: 1, padding: '10px', background: '#FFB347', border: 'none', borderRadius: '4px',
                  color: '#000', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace"
                }}
              >
                SWITCH TO DRY RUN
              </button>
              <button
                onClick={() => setModalType('none')}
                style={{
                  padding: '10px 16px', background: '#222', border: 'none', borderRadius: '4px',
                  color: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        {/* ── MODAL: GATE REQUIREMENTS FAILED ── */}
        <Modal
          id={`modal-gate-failed-${agent.id}`}
          isOpen={modalType === 'gate_failed'}
          onClose={() => setModalType('none')}
          title="Requirements Not Met"
        >
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', color: '#FF6B6B', borderRadius: '4px', display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🛑</span>
              <div>
                <strong>Funding required to switch to LIVE.</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#ccc' }}>
                  {gateDetails?.reason || 'Agent wallet has insufficient SOL balance.'}
                </p>
              </div>
            </div>

            <div style={{ background: '#0d0d12', border: '1px solid #1a1a28', padding: '12px', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Current Balance:</span>
                <span style={{ color: '#FF6B6B', fontWeight: 'bold' }}>{gateDetails?.wallet_balance_sol.toFixed(4)} SOL</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Minimum Required:</span>
                <span style={{ color: '#aaa' }}>0.1000 SOL</span>
              </div>
            </div>

            {gateDetails?.wallet_address && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase' }}>Deposit Address:</span>
                <div 
                  onClick={() => handleCopy(gateDetails.wallet_address!)}
                  style={{ 
                    padding: '8px', background: '#050508', border: '1px solid #222', borderRadius: '4px', fontSize: '10px', color: '#fff', 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#00C896')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#222')}
                  title="Click to copy"
                >
                  <span style={{ wordBreak: 'break-all' }}>{gateDetails.wallet_address}</span>
                  {isCopied ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00C896" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#00C896' }}>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => setModalType('none')}
              style={{
                width: '100%', padding: '10px', background: '#222', border: 'none', borderRadius: '4px',
                color: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", marginTop: '10px'
              }}
            >
              CLOSE
            </button>
          </div>
        </Modal>

        {/* ── MODAL: ERROR / FAILED OCCURRED ── */}
        <Modal
          id={`modal-error-${agent.id}`}
          isOpen={modalType === 'error'}
          onClose={() => setModalType('none')}
          title="Operation Failed"
        >
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', color: '#FF6B6B', borderRadius: '4px', display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🛑</span>
              <div>
                <strong>Error Encountered</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#ccc', lineHeight: 1.5 }}>
                  {errorMsg}
                </p>
              </div>
            </div>

            {isAuthError ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#444', fontSize: '9px', textTransform: 'uppercase', margin: '4px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: '#222' }} />
                  <span>AGENT SECRET KEY REQUIRED</span>
                  <div style={{ flex: 1, height: '1px', background: '#222' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    type="password"
                    placeholder="Enter Agent Secret Key..."
                    value={secretKeyInput}
                    onChange={(e) => setSecretKeyInput(e.target.value)}
                    style={{
                      padding: '10px', background: '#050508', border: '1px solid #222', borderRadius: '4px',
                      fontSize: '11px', color: '#fff', outline: 'none', fontFamily: "'JetBrains Mono', monospace",
                      width: '100%'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => {
                        setModalType('none');
                        setIsAuthError(false);
                        
                        // Automatically retry the pending operation
                        if (pendingRetry === 'toggle') {
                          handleToggleClick();
                        } else if (pendingRetry === 'live' || pendingRetry === 'dry_run') {
                          executeModeChange(pendingRetry);
                        }
                        setPendingRetry('none');
                      }}
                      disabled={!secretKeyInput.trim()}
                      style={{
                        flex: 1, padding: '10px', background: '#FFB347', border: 'none', borderRadius: '4px',
                        color: '#000', fontWeight: 'bold', fontSize: '11px', cursor: secretKeyInput.trim() ? 'pointer' : 'not-allowed', fontFamily: "'JetBrains Mono', monospace",
                        opacity: secretKeyInput.trim() ? 1 : 0.5
                      }}
                    >
                      CONFIRM KEY
                    </button>
                    <button
                      onClick={() => setModalType('none')}
                      style={{
                        padding: '10px 16px', background: '#222', border: 'none', borderRadius: '4px',
                        color: '#fff', fontSize: '11px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace"
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '10px', color: '#666' }}>
                    Lost your key? Contact <a href="https://t.me/Arkaddddd" target="_blank" rel="noopener noreferrer" style={{ color: '#00C896', textDecoration: 'underline' }}>@Arkaddddd</a> on Telegram.
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setModalType('none')}
                style={{
                  width: '100%', padding: '10px', background: '#222', border: 'none', borderRadius: '4px',
                  color: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", marginTop: '10px'
                }}
              >
                CLOSE
              </button>
            )}
          </div>
        </Modal>

        {/* ── MODAL: SUCCESS ── */}
        <Modal
          id={`modal-success-${agent.id}`}
          isOpen={modalType === 'success'}
          onClose={() => setModalType('none')}
          title="Operation Successful"
        >
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px', background: 'rgba(0, 200, 150, 0.1)', border: '1px solid rgba(0, 200, 150, 0.3)', color: '#00C896', borderRadius: '4px', display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>✨</span>
              <div>
                <strong>Success</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#ccc', lineHeight: 1.5 }}>
                  {successMsg}
                </p>
              </div>
            </div>

            <button
              onClick={() => setModalType('none')}
              style={{
                width: '100%', padding: '10px', background: '#222', border: 'none', borderRadius: '4px',
                color: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", marginTop: '10px'
              }}
            >
              CLOSE
            </button>
          </div>
        </Modal>
      </div>
    </>
  );
}

