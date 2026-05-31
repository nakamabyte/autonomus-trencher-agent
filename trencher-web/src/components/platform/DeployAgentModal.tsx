'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { BREEDS, BREED_LIST, BreedKey, DNA_TRAIT_LABELS, DNA_TRAIT_COLORS } from '@/constants/breeds';

// Risk modifiers for DNA traits
const RISK_MODIFIERS: Record<string, Partial<Record<string, number>>> = {
  conservative: { speed: -10, aggression: -20, rug_defense: +20, exit_discipline: +15 },
  balanced: { },
  aggressive: { speed: +10, aggression: +15, rug_defense: -10, momentum_sensitivity: +10 },
  degen: { speed: +20, aggression: +30, rug_defense: -30, momentum_sensitivity: +20, exit_discipline: -20 },
};

interface DeployAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (payload: any) => Promise<void>;
}

export function DeployAgentModal({ isOpen, onClose, onDeploy }: DeployAgentModalProps) {
  const [name, setName] = useState('');
  const [selectedBreed, setSelectedBreed] = useState<BreedKey>('scout');
  const [riskMode, setRiskMode] = useState<'conservative' | 'balanced' | 'aggressive' | 'degen'>('balanced');
  const [isDeploying, setIsDeploying] = useState(false);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setName('');
      setSelectedBreed('scout');
      setRiskMode('balanced');
      setIsDeploying(false);
    }
  }, [isOpen]);

  const breedConfig = BREEDS[selectedBreed];

  // Calculate preview traits
  const previewTraits = { ...breedConfig.traits } as Record<string, number>;
  const modifiers = RISK_MODIFIERS[riskMode] || {};
  for (const [trait, mod] of Object.entries(modifiers)) {
    if (previewTraits[trait] !== undefined) {
      previewTraits[trait] = Math.max(0, Math.min(100, previewTraits[trait] + (mod || 0)));
    }
  }

  const handleDeploy = async () => {
    if (!name.trim()) return;
    setIsDeploying(true);
    
    const payload = {
      name: name.trim(),
      breed: selectedBreed,
      traits: previewTraits,
    };

    await onDeploy(payload);
    setIsDeploying(false);
    onClose();
  };

  return (
    <Modal id="deploy-agent-modal" isOpen={isOpen} onClose={onClose} title="DEPLOY NEW AGENT">
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
                      setRiskMode(b.style);
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

          {/* Risk Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Risk Mode
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['conservative', 'balanced', 'aggressive', 'degen'] as const).map(mode => {
                const isSelected = riskMode === mode;
                const modeColors = {
                  conservative: '#81C784',
                  balanced: '#4FC3F7',
                  aggressive: '#FFB347',
                  degen: '#FF6B6B'
                };
                const color = modeColors[mode];
                return (
                  <button
                    key={mode}
                    onClick={() => setRiskMode(mode)}
                    style={{
                      flex: 1,
                      background: isSelected ? `${color}15` : '#0d0d12',
                      border: `1px solid ${isSelected ? color : '#1a1a28'}`,
                      color: isSelected ? color : '#888',
                      padding: '8px 0',
                      borderRadius: '4px',
                      fontSize: '10px',
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
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
              {isDeploying ? 'DEPLOYING...' : 'MINT DNA & DEPLOY'}
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
