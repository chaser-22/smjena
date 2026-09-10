'use client';

import { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import styles from './public.module.css';

export function ShiftSignal() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={styles.signalScene} data-paused={paused}>
      <div className={styles.signalCaption}>
        <span>OD POTREBE DO DOGOVORA</span>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? 'Pokreni animaciju' : 'Pauziraj animaciju'}
          aria-pressed={paused}
        >
          {paused ? (
            <Play size={15} aria-hidden="true" />
          ) : (
            <Pause size={15} aria-hidden="true" />
          )}
        </button>
      </div>
      <svg
        viewBox="0 0 420 100"
        aria-hidden="true"
        className={styles.signalDrawing}
      >
        <path
          d="M60 42 H360"
          stroke="#768398"
          strokeWidth="1"
          strokeDasharray="3 7"
        />
        <circle
          className={styles.signalRing}
          cx="60"
          cy="42"
          r="29"
          fill="none"
          stroke="#ff7953"
        />
        <circle
          className={styles.signalArrival}
          cx="360"
          cy="42"
          r="29"
          fill="none"
          stroke="#77f0bd"
        />
        <circle cx="60" cy="42" r="23" fill="#f4f1e9" />
        <path
          d="M47 37 H73 L70 29 H50 Z M49 38 V53 H71 V38 M57 53 V43 H63 V53"
          fill="none"
          stroke="#101d34"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="360" cy="42" r="23" fill="#f4f1e9" />
        <rect
          x="352"
          y="28"
          width="16"
          height="28"
          rx="3"
          fill="none"
          stroke="#101d34"
          strokeWidth="2"
        />
        <path
          d="M356 41 L359 44 L364 37"
          fill="none"
          stroke="#08765b"
          strokeWidth="2"
        />
        <g className={styles.signalPacket}>
          <circle cx="90" cy="42" r="12" fill="#ff7953" fillOpacity=".15" />
          <circle cx="90" cy="42" r="5" fill="#ff7953" />
        </g>
        <text x="60" y="90" textAnchor="middle" fill="#f4f1e9" fontSize="11">
          LOKAL OBJAVI
        </text>
        <text x="360" y="90" textAnchor="middle" fill="#f4f1e9" fontSize="11">
          RADNIK POTVRDI
        </text>
      </svg>
      <p className="sr-only">
        Ilustracija: lokal objavi potrebu, signal stiže do radnika, radnik
        potvrdi smjenu. Nije prikaz aktivnosti uživo.
      </p>
    </div>
  );
}
