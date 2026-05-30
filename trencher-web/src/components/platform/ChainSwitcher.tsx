import React from 'react';

const CHAINS = [
  { id: 'solana', label: 'Solana', color: '#9945FF' },
  { id: 'base',   label: 'Base',   color: '#0052FF' },
];

export function ChainSwitcher({ activeChain, onSwitch }: { activeChain: string; onSwitch: (chain: string) => void }) {
  return (
    <div className="flex gap-2 items-center bg-[#111] p-1 rounded-lg border border-[#333]">
      {CHAINS.map(chain => (
        <button
          key={chain.id}
          onClick={() => onSwitch(chain.id)}
          className="px-3 py-1 text-xs font-semibold rounded-md transition-all"
          style={{
            background: activeChain === chain.id ? `${chain.color}20` : 'transparent',
            color: activeChain === chain.id ? chain.color : '#888',
            border: `1px solid ${activeChain === chain.id ? chain.color : 'transparent'}`
          }}
        >
          {chain.label}
        </button>
      ))}
    </div>
  );
}
