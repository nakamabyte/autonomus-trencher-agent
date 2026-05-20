'use client';

import { useState } from 'react';
import { STRATEGY_CARDS } from '@/constants/platform';

export function Strategies() {
  const [selected, setSelected] = useState<number | null>(null);

  const toggle = (i: number) => {
    setSelected(prev => (prev === i ? null : i));
  };

  return (
    <section id="strategies">
      <div className="wrap">
        <div className="sec-label">Strategies</div>
        <h2 className="sec-h2">Four Built-in<br />Strategies</h2>
        <p className="sec-body">
          Click a strategy card to see its default parameters. All configurable via /stratset.
        </p>
        <div className="strat-grid">
          {STRATEGY_CARDS.map((card, i) => (
            <div
              key={card.num}
              className={`strat-card${selected === i ? ' sel' : ''}`}
              onClick={() => toggle(i)}
            >
              <span className="sc-num">{card.num}</span>
              <div className="sc-name" style={{ color: card.color }}>{card.name}</div>
              <p className="sc-desc">{card.desc}</p>
              <div className="sc-tags">
                {card.tags.map(tag => (
                  <div key={tag} className="sc-tag">{tag}</div>
                ))}
              </div>
              <div className="sc-detail">
                {card.params.map(([k, v]) => (
                  <div key={k} className="sc-param">
                    <span className="sc-pk">{k}</span>
                    <span className="sc-pv">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
