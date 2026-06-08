'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Modal } from '@/components/ui/Modal';
import { BREEDS, BREED_LIST, BreedKey, DNA_TRAIT_LABELS, DNA_TRAIT_COLORS } from '@/constants/breeds';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction } from '@solana/web3.js';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const DEPLOY_FEES: Record<string, number> = {
  scout: 0.025, degen: 0.025, canary: 0.025,
  sniper: 0.05, bunker: 0.05, whale_tracker: 0.05, drill_sergeant: 0.05, social_scout: 0.05,
  mole: 0.1, berserker: 0.1, reaper: 0.1, ghost: 0.1,
  commander: 0.2,
};

// Risk modifiers removed; TP and SL are now set explicitly by the user

interface DeployAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (payload: Record<string, unknown>) => Promise<any>;
}

export function DeployAgentModal({ isOpen, onClose, onDeploy }: DeployAgentModalProps) {
  const [name, setName] = useState('');
  const [selectedBreed, setSelectedBreed] = useState<BreedKey>('scout');
  const [tpPercent, setTpPercent] = useState<number>(100);
  const [slPercent, setSlPercent] = useState<number>(-20);
  const [entryPreference, setEntryPreference] = useState<'wait_for_dip' | 'immediate'>('wait_for_dip');
  const [exitPreference, setExitPreference] = useState<'trailing_tp' | 'fixed_tp'>('trailing_tp');
  const [rugFilter, setRugFilter] = useState<number>(0.20);
  const [isDeploying, setIsDeploying] = useState(false);
  const [confirmData, setConfirmData] = useState<{ txBase64: string; confirmedFee: number; split: any; payload: any } | null>(null);
  const [alertData, setAlertData] = useState<{ title: string; message: string; type: 'error' | 'success'; txHash?: string; onOk?: () => void } | null>(null);
  const [copied, setCopied] = useState(false);
  const [whaleWallets, setWhaleWallets] = useState<string[]>([]);
  const [walletInput, setWalletInput] = useState('');
  const [tgGroups, setTgGroups] = useState<string[]>([]);
  const [tgGroupInput, setTgGroupInput] = useState('');
  const [socialWeight, setSocialWeight] = useState<number | null>(null);
  const { publicKey, sendTransaction } = useWallet();

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

  const fee = DEPLOY_FEES[selectedBreed] || 0.05;

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setName('');
        setSelectedBreed('scout');
        setTpPercent(100);
        setSlPercent(-20);
        setEntryPreference('wait_for_dip');
        setExitPreference('trailing_tp');
        setRugFilter(0.20);
        setIsDeploying(false);
        setConfirmData(null);
        setAlertData(null);
        setWhaleWallets([]);
        setWalletInput('');
        setTgGroups([]);
        setTgGroupInput('');
        setSocialWeight(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const breedConfig = BREEDS[selectedBreed];

  // Calculate preview traits
  const previewTraits = { ...breedConfig.traits } as Record<string, number>;
  if (socialWeight !== null) {
    previewTraits.social_signal_weight = socialWeight;
  }

  const handleDeploy = async () => {
    if (!name.trim()) return;
    if (!publicKey) return setAlertData({ title: 'WALLET REQUIRED', message: 'Please connect your wallet first.', type: 'error' });
    setIsDeploying(true);
    
    try {
      const payload = {
        name: name.trim(),
        breed: selectedBreed,
        traits: previewTraits,
        tpPercent,
        slPercent,
        entryPreference,
        exitPreference,
        rugFilter,
        whaleWallets: selectedBreed === 'whale_tracker' ? whaleWallets : [],
        tgGroups: selectedBreed === 'social_scout' ? tgGroups : [],
      };

      // 1. Request transaction from backend
      const res = await fetch('/api/deploy/create-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: publicKey.toBase58(),
          breed: selectedBreed,
          dnaConfig: payload,
        }),
      });
      
      if (!res.ok) {
        let errMsg = 'Failed to create transaction on server';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }
      
      const data = await res.json();
      const { transaction: txBase64, fee: confirmedFee, split } = data;

      // 2. Show confirm modal instead of window.confirm
      setConfirmData({ txBase64, confirmedFee, split, payload });
      setIsDeploying(false); // End loading on the first button
    } catch (err: any) {
      setAlertData({ title: 'DEPLOYMENT FAILED', message: err.message || 'Unknown error occurred.', type: 'error' });
      setIsDeploying(false);
    }
  };

  const executeDeploy = async () => {
    if (!confirmData || !publicKey) return;
    setIsDeploying(true);

    try {
      // 3. Send transaction
      const tx = Transaction.from(Buffer.from(confirmData.txBase64, 'base64'));
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com');
      
      // Refresh blockhash via server-side proxy to bypass public RPC 403 CORS restrictions
      const bhRes = await fetch('/api/deploy/latest-blockhash');
      if (!bhRes.ok) {
        throw new Error('Failed to fetch latest blockhash from server');
      }
      const { blockhash } = await bhRes.json();
      tx.recentBlockhash = blockhash;
      
      const sig = await sendTransaction(tx, connection);

      // 4. Verify and deploy agent
      const confirmRes = await fetch('/api/deploy/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: sig, breed: selectedBreed, dnaConfig: confirmData.payload }),
      });

      if (!confirmRes.ok) {
        let errMsg = 'Failed to confirm deployment on backend';
        try {
          const errData = await confirmRes.json();
          errMsg = errData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const deployedAgent = await onDeploy(confirmData.payload);
      setConfirmData(null);
      setAlertData({ 
        title: 'SUCCESS: SAVE YOUR SECRET KEY NOW', 
        message: `${selectedBreed} Trencher deployed successfully!\n\nYOUR AGENT SECRET KEY:\n${deployedAgent.agent_secret_key}\n\nSave this key securely now. You will need it to toggle Live/Dry Run modes. It will never be shown again.\nIf lost, contact @Arkaddddd on Telegram.`, 
        type: 'success',
        txHash: sig,
        onOk: onClose
      });
    } catch (err: any) {
      setAlertData({ title: 'DEPLOYMENT FAILED', message: err.message || 'Unknown error occurred.', type: 'error' });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <>
      <Modal id="deploy-agent-modal" isOpen={isOpen && !confirmData && !alertData} onClose={onClose} title="DEPLOY NEW AGENT">
        <div style={{ display: 'flex', gap: '24px', minHeight: '400px' }}>
        
        {/* Left Column: Configuration */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Agent Name */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Agent Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Gravehound #184"
              style={{
                width: '100%',
                background: '#0d0d12',
                border: '1px solid #1a1a28',
                color: '#fff',
                padding: '10px 12px',
                borderRadius: '4px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Breed Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Select Breed
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              maxHeight: '220px',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: '4px'
            }}>
              {BREED_LIST.map(b => {
                const isAvailable = b.phase === 1;
                const isSelected = selectedBreed === b.key;
                return (
                  <button
                    key={b.key}
                    disabled={!isAvailable}
                    onClick={() => {
                      setSelectedBreed(b.key);
                      setSocialWeight(null);
                    }}
                    style={{
                      background: isSelected ? `${b.color}15` : '#0d0d12',
                      border: `1px solid ${isSelected ? b.color : '#1a1a28'}`,
                      padding: '10px',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                      opacity: isAvailable ? 1 : 0.4,
                      transition: 'all 0.2s',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px', color: b.color }}>{b.icon}</span>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: isSelected ? b.color : '#ccc' }}>{b.name}</span>
                      </div>
                      {!isAvailable && (
                        <span style={{ fontSize: '8px', background: '#222', color: '#888', padding: '2px 4px', borderRadius: '2px' }}>SOON</span>
                      )}
                    </div>
                    <div style={{ fontSize: '9px', color: '#666', fontFamily: "'JetBrains Mono', monospace" }}>
                      {b.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Strategy Overrides (TP & SL) */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Take Profit (%)
              </label>
              <input
                type="number"
                value={tpPercent}
                onChange={e => setTpPercent(parseInt(e.target.value) || 0)}
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
                onChange={e => setSlPercent(parseInt(e.target.value) || 0)}
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

          {/* Entry Preference */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Entry Preference
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['wait_for_dip', 'immediate'] as const).map(pref => {
                const isSelected = entryPreference === pref;
                const color = '#00C896';
                return (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setEntryPreference(pref)}
                    style={{
                      flex: 1,
                      background: isSelected ? `${color}15` : '#0d0d12',
                      border: `1px solid ${isSelected ? color : '#1a1a28'}`,
                      color: isSelected ? color : '#888',
                      padding: '8px 0',
                      borderRadius: '4px',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {pref.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exit Preference */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Exit Preference
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['trailing_tp', 'fixed_tp'] as const).map(pref => {
                const isSelected = exitPreference === pref;
                const color = '#FFB347';
                return (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => setExitPreference(pref)}
                    style={{
                      flex: 1,
                      background: isSelected ? `${color}15` : '#0d0d12',
                      border: `1px solid ${isSelected ? color : '#1a1a28'}`,
                      color: isSelected ? color : '#888',
                      padding: '8px 0',
                      borderRadius: '4px',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {pref.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Whale Tracker: Target Wallets */}
          {selectedBreed === 'whale_tracker' && (
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
                These wallets will be added to the global tracked wallets list to be copied by your agent. You can input multiple wallets by separating them with commas or new lines.
              </div>
            </div>
          )}

          {/* Social Scout: TG Alpha Groups */}
          {selectedBreed === 'social_scout' && (
            <div>
              <label style={{ display: 'block', fontSize: '10px', color: '#00BBF9', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                📡 TG Alpha Groups (Group IDs or @usernames)
              </label>
              <div style={{
                background: '#0d0d12',
                border: '1px solid rgba(0,187,249,0.3)',
                borderRadius: '4px',
                padding: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px'
              }}>
                {tgGroups.map(group => (
                  <span key={group} style={{
                    background: 'rgba(0,187,249,0.1)',
                    color: '#00BBF9',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    {group}
                    <button
                      onClick={() => setTgGroups(prev => prev.filter(g => g !== group))}
                      style={{
                        background: 'none', border: 'none', color: '#888',
                        cursor: 'pointer', padding: '0 2px', fontSize: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px'
                      }}
                    >✕</button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tgGroupInput}
                  onChange={e => setTgGroupInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const vals = tgGroupInput.split(/[,\n\s]+/).map(v => v.trim()).filter(Boolean);
                      if (vals.length) { setTgGroups(prev => [...new Set([...prev, ...vals])]); setTgGroupInput(''); }
                    }
                  }}
                  onBlur={() => {
                    const vals = tgGroupInput.split(/[,\n\s]+/).map(v => v.trim()).filter(Boolean);
                    if (vals.length) { setTgGroups(prev => [...new Set([...prev, ...vals])]); setTgGroupInput(''); }
                  }}
                  placeholder={tgGroups.length === 0 ? "-100123456789 or @groupname" : "Add more..."}
                  style={{
                    flex: 1, minWidth: '180px', background: 'transparent', border: 'none',
                    color: '#00BBF9', fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px', outline: 'none', padding: '4px'
                  }}
                />
              </div>
              <div style={{ fontSize: '9px', color: '#888', marginTop: '6px', lineHeight: '1.5' }}>
                Enter numeric group IDs (e.g. <code style={{color:'#00BBF9'}}>-100123456789</code>) or @usernames.
                Your agent will monitor these groups and auto-trade calls that pass DNA filters.
                Groups with &lt;35% win rate are auto-demoted after 20 trades.
              </div>

              {/* Social Weight Slider inside social_scout */}
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '10px', color: '#00BBF9', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Social Signal Weight
                  </label>
                  <span style={{ fontSize: '10px', color: '#00BBF9', fontFamily: "'JetBrains Mono', monospace" }}>
                    {socialWeight ?? previewTraits.social_signal_weight ?? 50}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={socialWeight ?? previewTraits.social_signal_weight ?? 50}
                  onChange={e => setSocialWeight(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: '#00BBF9',
                    cursor: 'pointer',
                    background: '#0d0d12',
                  }}
                />
                <div style={{ fontSize: '9px', color: '#888', marginTop: '6px' }}>
                  Weight &lt; 30 will HARD SKIP all TG group calls. Weight &gt; 80 leans heavily into them.
                </div>
              </div>
            </div>
          )}

          {/* Rug Filter */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Rug Filter Sensitivity
              </label>
              <span style={{ fontSize: '10px', color: '#FF6B6B', fontFamily: "'JetBrains Mono', monospace" }}>
                {(rugFilter * 100).toFixed(0)}% Limit
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.50"
              step="0.01"
              value={rugFilter}
              onChange={e => setRugFilter(parseFloat(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#FF6B6B',
                cursor: 'pointer',
                background: '#0d0d12',
              }}
            />
          </div>

        </div>

        {/* Right Column: DNA Preview */}
        <div style={{ width: '240px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#0a0a0f', border: '1px solid #1a1a24', borderRadius: '6px', padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#FFB347', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', fontWeight: 'bold' }}>
              DNA Preview
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {Object.entries(previewTraits).map(([trait, value]) => {
                const label = DNA_TRAIT_LABELS[trait] || trait;
                const color = DNA_TRAIT_COLORS[trait] || '#555';
                const originalValue = breedConfig.traits[trait as keyof typeof breedConfig.traits] || 0;
                const diff = value - originalValue;
                
                return (
                  <div key={trait} style={{ marginBottom: '10px' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      marginBottom: '4px',
                      fontSize: '9px', fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      <span style={{ color: '#888' }}>{label}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {diff !== 0 && (
                          <span style={{ color: diff > 0 ? '#00C896' : '#FF6B6B' }}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        )}
                        <span style={{ color: '#ddd' }}>{value}</span>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${value}%`,
                        background: color,
                        borderRadius: '2px',
                        transition: 'width .3s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '16px', background: '#111118', borderRadius: '6px', padding: '12px', fontSize: '10px', fontFamily: 'monospace' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #222', paddingBottom: '4px' }}>
                <span style={{ color: '#888' }}>Deploy fee</span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{fee} SOL</span>
              </div>
              <div style={{ color: '#00C896' }}>50% holder rewards: {(fee * 0.50).toFixed(4)}</div>
              <div style={{ color: '#FF6B6B' }}>25% burn $AUTR: {(fee * 0.25).toFixed(4)}</div>
              <div style={{ color: '#00BBF9' }}>25% agent treasury: {(fee * 0.25).toFixed(4)}</div>
            </div>

            {!publicKey ? (
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                <WalletMultiButton style={{
                  width: '100%',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #512da8, #673ab7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  padding: '12px 24px',
                  height: 'auto',
                  lineHeight: 'normal'
                }}>
                  CONNECT WALLET TO DEPLOY
                </WalletMultiButton>
              </div>
            ) : (
              <button
                disabled={isDeploying || !name.trim()}
                onClick={handleDeploy}
                style={{
                  marginTop: '16px',
                  width: '100%',
                  padding: '12px',
                  background: name.trim() ? `${breedConfig.color}20` : '#111',
                  color: name.trim() ? breedConfig.color : '#555',
                  border: `1px solid ${name.trim() ? breedConfig.color : '#222'}`,
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  letterSpacing: '1px',
                  cursor: name.trim() && !isDeploying ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                {isDeploying ? 'DEPLOYING...' : `DEPLOY TRENCHER — ${fee} SOL`}
              </button>
            )}
            <p style={{ fontSize: '9px', color: '#444', marginTop: '8px', textAlign: 'center' }}>
              50% goes to holder rewards • 25% buys and burns $AUTR
            </p>
          </div>
        </div>

      </div>
      </Modal>

      {/* Confirmation Modal */}
      {confirmData && !alertData && (
        <Modal 
          id="confirm-deploy-modal" 
          isOpen={true} 
          onClose={() => !isDeploying && setConfirmData(null)} 
          title="CONFIRM DEPLOYMENT"
        >
          <div style={{ padding: '8px 4px', fontFamily: 'monospace' }}>
            <h3 style={{ color: '#fff', marginBottom: '24px', fontSize: '16px' }}>
              Deploy {selectedBreed} Trencher
            </h3>
            
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #1a1a24' }}>
                <span style={{ color: '#888', fontSize: '14px' }}>Total fee</span>
                <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>{confirmData?.confirmedFee} SOL</span>
              </div>
              <div style={{ padding: '12px', background: '#0a0a10', borderRadius: '4px', border: '1px solid #1a1a28' }}>
                <div style={{ color: '#00C896', marginBottom: '12px', fontSize: '13px' }}>50% holder rewards: {confirmData?.split?.reward_pool} SOL</div>
                <div style={{ color: '#FF6B6B', marginBottom: '12px', fontSize: '13px' }}>25% burn $AUTR: {confirmData?.split?.burn} SOL</div>
                <div style={{ color: '#00BBF9', marginBottom: '12px', fontSize: '13px' }}>25% agent treasury: {confirmData?.split?.agent_treasury} SOL</div>
                <div style={{ color: '#F4B41A', fontSize: '13px' }}>0% dev fee (waived)</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                disabled={isDeploying}
                onClick={() => setConfirmData(null)}
                style={{ 
                  flex: 1, padding: '12px', background: '#1a1a24', color: '#fff', 
                  border: '1px solid #333', borderRadius: '4px', cursor: isDeploying ? 'not-allowed' : 'pointer', 
                  fontWeight: 'bold', transition: 'all 0.2s'
                }}
              >
                CANCEL
              </button>
              <button 
                disabled={isDeploying}
                onClick={executeDeploy}
                style={{ 
                  flex: 1, padding: '12px', background: breedConfig.color, color: '#000', 
                  border: 'none', borderRadius: '4px', cursor: isDeploying ? 'not-allowed' : 'pointer', 
                  fontWeight: 'bold', transition: 'all 0.2s',
                  opacity: isDeploying ? 0.7 : 1
                }}
              >
                {isDeploying ? 'CONFIRMING...' : 'CONFIRM'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Alert Modal */}
      {alertData && (
        <Modal 
          id="alert-modal" 
          isOpen={true} 
          onClose={() => {
            const cb = alertData?.onOk;
            setAlertData(null);
            if (cb) cb();
          }} 
          title={alertData?.title}
        >
          <div style={{ padding: '12px 8px', fontFamily: 'monospace', maxWidth: '360px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
              {alertData?.title}
            </h2>
            <div style={{ 
              fontSize: '14px', 
              color: alertData?.type === 'error' ? '#FF6B6B' : '#00C896', 
              background: alertData?.type === 'error' ? 'rgba(255, 107, 107, 0.1)' : 'rgba(0, 200, 150, 0.1)',
              padding: '16px',
              borderRadius: '4px',
              marginBottom: '24px',
              lineHeight: 1.5
            }}>
              {alertData?.message}
            </div>

            {alertData?.txHash && (
              <div style={{
                background: '#0d0d12',
                border: '1px solid #1a1a28',
                borderRadius: '4px',
                padding: '10px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}
                >
                  <span style={{ fontSize: '11px', color: '#888' }}>TX:</span>
                  <a 
                    href={`https://explorer.solana.com/tx/${alertData.txHash}`} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '11px',
                      color: '#00C896',
                      textDecoration: 'none'
                    }}
                  >
                    {alertData?.txHash}
                  </a>
                </div>
                <button
                  onClick={() => {
                    if (alertData?.txHash) navigator.clipboard.writeText(alertData.txHash);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{
                    background: copied ? 'rgba(0, 200, 150, 0.2)' : 'rgba(0, 200, 150, 0.1)',
                    border: 'none',
                    color: '#00C896',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                    borderRadius: '2px',
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: 'all 0.2s',
                    width: '65px',
                    textAlign: 'center'
                  }}
                >
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
            )}

            <button 
              onClick={() => {
                const cb = alertData?.onOk;
                setAlertData(null);
                setCopied(false);
                if (cb) cb();
              }}
              style={{ 
                width: '100%', padding: '12px', background: '#1a1a24', color: '#fff', 
                border: '1px solid #333', borderRadius: '4px', cursor: 'pointer', 
                fontWeight: 'bold', transition: 'all 0.2s'
              }}
            >
              OK
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
