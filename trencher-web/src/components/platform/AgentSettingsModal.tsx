'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { AgentDna } from '@/types';

interface AgentSettingsModalProps {
  agent: AgentDna;
  onClose: () => void;
}

export function AgentSettingsModal({ agent, onClose }: AgentSettingsModalProps) {
  const [tpPercent, setTpPercent] = useState<number | ''>(agent.tp_percent ?? 100);
  const [slPercent, setSlPercent] = useState<number | ''>(agent.sl_percent ?? -20);
  const [whaleWallets, setWhaleWallets] = useState<string[]>(agent.whale_wallets ? agent.whale_wallets.split(',').map(w => w.trim()).filter(Boolean) : []);
  const [walletInput, setWalletInput] = useState('');
  const [secretKey, setSecretKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    headers['x-client-key'] = secretKey;
    return headers;
  };

  const addWallets = (input: string) => {
    const newWallets = input.split(/[,\n\s]+/).map(w => w.trim()).filter(Boolean);
    if (newWallets.length > 0) {
      setWhaleWallets(prev => {
        const unique = new Set([...prev, ...newWallets]);
        return Array.from(unique);
      });
      setWalletInput('');
    }
  };

  const removeWallet = (walletToRemove: string) => {
    setWhaleWallets(prev => prev.filter(w => w !== walletToRemove));
  };

  const handleWalletKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addWallets(walletInput);
    }
  };

  const handleUpdate = async () => {
    if (!secretKey.trim() || tpPercent === '' || slPercent === '') {
      setErrorMsg('All fields are required.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/core-proxy/agent/${agent.id}/update-strategy`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          tpPercent, 
          slPercent,
          whaleWallets: agent.breed === 'whale_tracker' ? whaleWallets : []
        }),
      });

      if (res.status === 401) {
        setErrorMsg('Invalid Secret Key. Authentication failed.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error('Failed to update agent strategy.');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while updating the strategy.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal id="agent-settings-modal" isOpen={true} onClose={onClose} title="AGENT STRATEGY SETTINGS">
      <div style={{ padding: '8px 4px', fontFamily: 'monospace' }}>
        <h3 style={{ color: '#fff', marginBottom: '8px', fontSize: '14px' }}>
          Update Strategy: {agent.name}
        </h3>
        <p style={{ color: '#888', marginBottom: '24px', fontSize: '11px', lineHeight: 1.5 }}>
          Modify the Take Profit and Stop Loss parameters for your agent. These changes will take effect immediately.
        </p>

        {success ? (
          <div style={{ color: '#00C896', textAlign: 'center', margin: '30px 0', fontSize: '14px', fontWeight: 'bold' }}>
            ✓ Strategy Updated Successfully!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            {errorMsg && (
              <div style={{ color: '#FF6B6B', fontSize: '11px', background: 'rgba(255, 107, 107, 0.1)', padding: '10px', borderRadius: '4px' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Take Profit (%)
                </label>
                <input
                  type="number"
                  value={tpPercent}
                  onChange={e => setTpPercent(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    background: '#0d0d12',
                    border: '1px solid #1a1a28',
                    color: '#00C896',
                    padding: '10px 12px',
                    borderRadius: '4px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '13px',
                    outline: 'none',
                    fontWeight: 'bold',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Stop Loss (%)
                </label>
                <input
                  type="number"
                  value={slPercent}
                  onChange={e => setSlPercent(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    background: '#0d0d12',
                    border: '1px solid #1a1a28',
                    color: '#FF6B6B',
                    padding: '10px 12px',
                    borderRadius: '4px',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '13px',
                    outline: 'none',
                    fontWeight: 'bold',
                  }}
                />
              </div>
            </div>

            {agent.breed === 'whale_tracker' && (
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#00C896', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Tracked Wallets (Target Smart Money / Whales)
                </label>
                <div style={{
                  background: '#0d0d12',
                  border: '1px solid #1a1a28',
                  borderRadius: '4px',
                  padding: '8px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}>
                  {whaleWallets.map(wallet => (
                    <span key={wallet} style={{
                      background: '#1a1a28',
                      color: '#00C896',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: "'JetBrains Mono', monospace",
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      wordBreak: 'break-all'
                    }}>
                      {wallet}
                      <button
                        onClick={() => removeWallet(wallet)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#888',
                          cursor: 'pointer',
                          padding: '0 2px',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: '4px'
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={walletInput}
                    onChange={e => setWalletInput(e.target.value)}
                    onKeyDown={handleWalletKeyDown}
                    onPaste={e => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text');
                      addWallets(pasted);
                    }}
                    onBlur={() => addWallets(walletInput)}
                    placeholder={whaleWallets.length === 0 ? "Paste wallets here, press Enter..." : "Add more..."}
                    style={{
                      flex: 1,
                      minWidth: '150px',
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '11px',
                      outline: 'none',
                      padding: '4px'
                    }}
                  />
                </div>
                <div style={{ fontSize: '9px', color: '#888', marginTop: '6px' }}>
                  These wallets will be added to the global tracked wallets list when updated. You can input multiple wallets by separating them with commas or new lines.
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Agent Secret Key
              </label>
              <input
                type="password"
                placeholder="Enter Secret Key to Auth"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0d0d12',
                  border: '1px solid #1a1a28',
                  borderRadius: '4px',
                  color: '#fff',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <button
                onClick={handleUpdate}
                disabled={loading || !secretKey.trim() || tpPercent === '' || slPercent === ''}
                style={{
                  flex: 1, padding: '10px', background: '#00BBF9', border: 'none', borderRadius: '4px',
                  color: '#000', fontWeight: 'bold', fontSize: '12px', cursor: (secretKey.trim() && tpPercent !== '' && slPercent !== '' && !loading) ? 'pointer' : 'not-allowed', fontFamily: "'JetBrains Mono', monospace",
                  opacity: (secretKey.trim() && tpPercent !== '' && slPercent !== '' && !loading) ? 1 : 0.5
                }}
              >
                {loading ? 'UPDATING...' : 'UPDATE STRATEGY'}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '10px 16px', background: '#222', border: 'none', borderRadius: '4px',
                  color: '#fff', fontSize: '12px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
