import React from 'react';

export function FundAgentStep({ agent }: { agent: any }) {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  return (
    <div className="fund-step p-4 border rounded shadow">
      <h3 className="text-xl font-bold mb-2">Fund Your Agent</h3>
      <p className="mb-4 text-gray-600">Send SOL to your agent's wallet to activate trading.</p>

      <div className="wallet-box bg-gray-100 p-2 rounded flex justify-between items-center mb-4">
        <span className="label font-semibold">Agent Wallet:</span>
        <code className="ml-2 bg-white px-2 py-1 rounded">{agent.agent_wallet}</code>
        <button className="ml-4 bg-blue-500 text-white px-2 py-1 rounded" onClick={() => copy(agent.agent_wallet)}>Copy</button>
      </div>

      <div className="funding-info text-sm mb-4">
        <p>Minimum to activate: <strong>0.1 SOL</strong></p>
        <p>Recommended: <strong>0.3 - 0.5 SOL</strong> for meaningful position sizes</p>
      </div>

      <div className="status font-medium">
        Current balance: {agent.wallet_balance_sol || 0} SOL <br/>
        {(agent.wallet_balance_sol || 0) >= 0.1
          ? <span className="ready text-green-600">Ready to activate</span>
          : <span className="pending text-yellow-600">Awaiting funding</span>}
      </div>
    </div>
  );
}
