'use client';

import { useState } from 'react';
import { Check, Pause, Play, RadioTower, UserRound } from 'lucide-react';
import styles from './public.module.css';

export function ShiftSignal() {
  const [paused, setPaused] = useState(false);
  return (
    <figure className={styles.dispatch} data-paused={paused}>
      <figcaption>
        <span>
          <i /> SMJENA / DISPATCH
        </span>
        <span>ILUSTRACIJA PROCESA</span>
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
      </figcaption>
      <div className={styles.radar} aria-hidden="true">
        <div className={styles.radarGrid} />
        <div className={styles.radarSweep} />
        <span className={`${styles.city} ${styles.cityA}`}>BD</span>
        <span className={`${styles.city} ${styles.cityB}`}>PG</span>
        <span className={`${styles.city} ${styles.cityC}`}>KO</span>
        <div className={styles.origin}>
          <RadioTower />
        </div>
        <div className={styles.route}>
          <i data-testid="signal-packet" />
        </div>
        <div className={styles.target}>
          <UserRound />
        </div>
      </div>
      <div
        className={styles.dispatchStates}
        aria-hidden="true"
        data-testid="dispatch-states"
      >
        <div className={styles.stateNeed}>
          <span>01 / POTREBA</span>
          <strong>Nedostaje radnik</strong>
          <small>Uslovi objavljeni</small>
        </div>
        <div className={styles.stateSeen}>
          <span>02 / PRIJAVA I IZBOR</span>
          <strong>Poslodavac šalje ponudu</strong>
          <small>Prijava ne rezerviše mjesto</small>
        </div>
        <div className={styles.stateConfirmed}>
          <span>
            <Check /> 03 / POTVRĐENO
          </span>
          <strong>Radnik prihvata ponudu</strong>
          <small>Kontakt je dostupan</small>
        </div>
      </div>
      <div className={styles.dispatchProgress} aria-hidden="true">
        <i />
      </div>
      <p className="sr-only">
        Animirana ilustracija procesa: lokal objavljuje uslove, radnik se prijavljuje,
        poslodavac šalje ponudu, a radnik je prihvata. Ovo nije prikaz aktivnosti
        uživo.
      </p>
    </figure>
  );
}
