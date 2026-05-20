'use client';

import { useState } from 'react';
import { FEATURE_ITEMS } from '@/constants/platform';

const CHECKLIST_ITEMS = [
  'Crash-resilient SQLite persistence',
  'Hot-reload strategy config',
  'Smart money wallet overlap',
  'CT narrative via FXTwitter',
  'Trailing TP + partial exits',
  'Trade lesson generation',
];

export function Features() {
  const [activeItems, setActiveItems] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setActiveItems(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <section id="features">
      <div className="wrap">
        <div className="feat-layout">
          <div className="feat-side">
            <div className="sec-label">Capabilities</div>
            <h2 className="sec-h2" style={{ color: '#fff' }}>
              Built for<br />Serious<br />Trenching
            </h2>
            <p className="sec-body">Click any feature card for full technical details.</p>
            <div className="fs-stat">
              <div className="fs-stat-n">10<em>×</em></div>
              <div className="fs-stat-l">LLM candidates / cycle</div>
            </div>
            <div className="fs-stat" style={{ marginTop: '20px' }}>
              <div className="fs-stat-n">4<em>+</em></div>
              <div className="fs-stat-l">Configurable strategies</div>
            </div>
            <ul className="feat-side-checklist">
              {CHECKLIST_ITEMS.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="feat-grid">
            {FEATURE_ITEMS.map((item, i) => (
              <div
                key={item.num}
                className={`feat-item${activeItems.has(i) ? ' active' : ''}`}
                onClick={() => toggle(i)}
              >
                <div className="fi-num">{item.num}</div>
                <div className="fi-title">{item.title}</div>
                <p className="fi-desc">{item.desc}</p>
                <div className="fi-more">
                  <div className="fi-more-text">{item.more}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
