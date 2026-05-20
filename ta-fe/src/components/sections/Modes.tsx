'use client';

import { useState } from 'react';
import { MODE_CARDS } from '@/constants/platform';

export function Modes() {
  const [activeMode, setActiveMode] = useState<number | null>(null);

  const toggle = (i: number) => {
    setActiveMode(prev => (prev === i ? null : i));
  };

  return (
    <section id="modes">
      <div className="wrap">
        <div className="modes-hd">
          <div className="sec-label">Execution</div>
          <h2 className="sec-h2">Three Modes.<br />One Config.</h2>
        </div>
        <div className="modes-grid">
          {MODE_CARDS.map((card, i) => (
            <div
              key={card.num}
              className={`mode-card${card.featured ? ' featured' : ''}${activeMode === i ? ' active-mode' : ''}`}
              onClick={() => toggle(i)}
            >
              {card.badge && <div className="mode-badge">{card.badge}</div>}
              <span className="mode-num">{card.num}</span>
              <div className="mode-name">{card.name}</div>
              <div className="mode-title">{card.title}</div>
              <p className="mode-desc">{card.desc}</p>
              <div className="mode-code">
                {card.code.split('\n').map((line, j) => (
                  <span key={j}>{line}{j < card.code.split('\n').length - 1 && <br />}</span>
                ))}
              </div>
              <div className="mode-detail">
                <ul className="md-list">
                  {card.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
