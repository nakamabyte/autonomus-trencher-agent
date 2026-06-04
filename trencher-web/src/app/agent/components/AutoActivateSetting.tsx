import React from 'react';

export function AutoActivateSetting({ agent, updateAutoActivate }: { agent: any; updateAutoActivate: (id: string, val: boolean) => void }) {
  return (
    <div className="auto-activate">
      <label>
        <input
          type="checkbox"
          checked={agent.auto_activate ?? true}
          onChange={(e) => updateAutoActivate(agent.id, e.target.checked)}
        />
        Auto-activate when funded
      </label>
      <p className="hint text-sm text-gray-500">
        When ON: your agent starts trading automatically once you fund its wallet.
        When OFF: you manually switch it to live yourself.
      </p>
    </div>
  );
}
