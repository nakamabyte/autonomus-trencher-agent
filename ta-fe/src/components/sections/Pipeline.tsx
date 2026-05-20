'use client';

import { useState } from 'react';
import { PIPELINE_STEPS } from '@/constants/platform';

export function Pipeline() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(prev => (prev === i ? null : i));
  };

  return (
    <section id="pipeline">
      <div className="wrap">
        <div className="pipeline-hd">
          <div className="sec-label">Pipeline</div>
          <h2 className="sec-h2">Signal to<br />Execution</h2>
          <p className="sec-body">Click each step to expand the full details.</p>
        </div>
        <div className="pipe-grid">
          {PIPELINE_STEPS.map((step, i) => (
            <div
              key={step.num}
              className={`pipe-step${openIndex === i ? ' pipe-step-active' : ''}`}
              style={{ color: step.color }}
              onClick={() => toggle(i)}
            >
              <span className="pipe-num">{step.num}</span>
              <div className="pipe-icon">{step.icon}</div>
              <div className="pipe-title" style={{ color: step.color }}>{step.title}</div>
              <p className="pipe-desc">{step.desc}</p>
              <div className={`pipe-expand${openIndex === i ? ' open' : ''}`}>
                <div className="pipe-expand-body">
                  <ul className="pe-list">
                    {step.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
