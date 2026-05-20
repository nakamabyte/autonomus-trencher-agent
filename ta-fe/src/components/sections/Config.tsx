interface ConfigProps {
  onOpenPlatform: () => void;
}

export function Config({ onOpenPlatform }: ConfigProps) {
  return (
    <section id="config">
      <div className="wrap">
        <div className="cfg-layout">
          <div>
            <div className="sec-label">Setup</div>
            <h2 className="sec-h2">Up in<br />Four<br />Steps</h2>
            <p className="sec-body">
              Clone, configure .env, start with dry_run, tune from Telegram. No web dashboard to deploy.
            </p>
            <br /><br />
            <button className="btn-red" onClick={onOpenPlatform} type="button">
              Launch Dashboard
            </button>
          </div>
          <div className="cfg-code">
            <span className="cc"># 1. Clone &amp; install</span><br />
            <span className="ck">git clone</span>{' '}
            <span className="cv">... trencher-agent &amp;&amp; npm install</span><br /><br />

            <span className="cc"># 2. Configure .env</span><br />
            <span className="ck">TELEGRAM_BOT_TOKEN</span>=<span className="cg">your_bot_token</span><br />
            <span className="ck">TELEGRAM_CHAT_ID</span>=<span className="cg">your_chat_id</span><br />
            <span className="ck">SIGNAL_SERVER_KEY</span>=<span className="cg">your_key</span><br />
            <span className="ck">TRADING_MODE</span>=<span className="ca-">dry_run</span><br />
            <span className="ck">ENABLE_LLM</span>=<span className="cg">true</span><br />
            <span className="ck">LLM_MODEL</span>=<span className="cv">MiniMax-M2.7</span><br />
            <span className="ck">SOLANA_RPC_URL</span>=<span className="cv">https://mainnet.helius-rpc.com/?api-key=...</span><br /><br />

            <span className="cc"># 3. Start</span><br />
            <span className="ck">npm start</span><br /><br />

            <span className="cc"># 4. Control from Telegram</span><br />
            <span className="cr">/menu</span>{'  '}<span className="cc">→ open main control panel</span><br />
            <span className="cr">/strategy sniper</span>{'  '}<span className="cc">→ activate strategy</span><br />
            <span className="cr">/pnl</span>{'   '}<span className="cc">→ performance report</span><br />
            <span className="cr">/learn 30d</span>{' '}<span className="cc">→ generate trade lessons</span>
          </div>
        </div>
      </div>
    </section>
  );
}
