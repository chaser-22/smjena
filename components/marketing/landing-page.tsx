import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, ShieldCheck } from 'lucide-react';
import { PublicBrand } from './public-brand';
import { ShiftSignal } from './shift-signal';
import styles from './public.module.css';

export function LandingPage() {
  return (
    <div className={styles.publicPage}>
      <header className={styles.header}>
        <PublicBrand />
        <nav aria-label="Glavna navigacija">
          <a href="#kako-radi" className={styles.navAbout}>
            Kako radi
          </a>
          <Link href="/login">
            Prijavi se <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </nav>
      </header>
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>
              <span className={styles.signalDot} /> HITNA MREŽA RADA / CRNA GORA
            </p>
            <h1 id="hero-title">
              Kad fali
              <br />
              jedan.
              <br />
              <span>Stiže SMJENA.</span>
            </h1>
            <p className={styles.heroDescription}>
              Vidi smjenu. Vidi cijenu. Potvrdi mjesto.
              <br />
              Bez CV-a i dugog čekanja.
            </p>
            <div className={styles.heroActions}>
              <Link
                className={styles.primary}
                href="/login?intent=register&role=worker"
              >
                Pronađi smjenu <ArrowUpRight aria-hidden="true" />
              </Link>
              <Link
                className={styles.secondary}
                href="/login?intent=register&role=employer"
              >
                Pronađi radnika <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <p className={styles.returning}>
              Već imaš nalog? <Link href="/login">Prijavi se</Link>
            </p>
          </div>
          <ShiftSignal />
        </section>
        <div className={styles.liveRail} aria-label="Ugostiteljske uloge">
          <div>
            <span>KONOBAR</span>
            <i>✦</i>
            <span>ŠANKER</span>
            <i>✦</i>
            <span>KUVAR</span>
            <i>✦</i>
            <span>RECEPCIONER</span>
            <i>✦</i>
            <span>SOBARICA</span>
            <i>✦</i>
            <span aria-hidden="true">KONOBAR</span>
            <i aria-hidden="true">✦</i>
            <span aria-hidden="true">ŠANKER</span>
            <i aria-hidden="true">✦</i>
            <span aria-hidden="true">KUVAR</span>
            <i aria-hidden="true">✦</i>
            <span aria-hidden="true">RECEPCIONER</span>
            <i aria-hidden="true">✦</i>
            <span aria-hidden="true">SOBARICA</span>
            <i aria-hidden="true">✦</i>
          </div>
        </div>
        <section id="kako-radi" className={styles.how}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>01 / KAKO RADI</p>
            <h2>
              Od rupe u rasporedu
              <br />
              do jasnog dogovora.
            </h2>
          </div>
          <ol className={styles.steps}>
            <li>
              <span>01</span>
              <div>
                <h3>Objavi potrebu.</h3>
                <p>Uloga, tačno vrijeme, lokacija, uslovi i ukupna naknada.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Potvrdi mjesto.</h3>
                <p>
                  Radnik vidi cijelu ponudu i jednim potezom preuzima obavezu
                  dolaska.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Znate šta slijedi.</h3>
                <p>
                  Kontakt, dolazak, završetak i evidencija naknade ostaju vezani
                  za smjenu.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className={styles.roleSplit}>
          <div className={styles.workerSide}>
            <p className={styles.kicker}>ZA RADNIKE</p>
            <h2>
              Slobodan si?
              <br />
              <span>Radi danas.</span>
            </h2>
            <ul>
              <li>
                <Check aria-hidden="true" /> Uslovi prije potvrde
              </li>
              <li>
                <Check aria-hidden="true" /> Mjesto rezervisano odmah
              </li>
              <li>
                <Check aria-hidden="true" /> Pouzdanost koja se gradi radom
              </li>
            </ul>
            <Link
              className={styles.primary}
              href="/login?intent=register&role=worker"
            >
              Vidi smjene <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.employerSide}>
            <p className={styles.kicker}>ZA LOKALE, HOTELE I RESTORANE</p>
            <h2>
              Fali ti čovjek?
              <br />
              <span>Objavi smjenu.</span>
            </h2>
            <ul>
              <li>
                <Check aria-hidden="true" /> Jasan oglas ispod 60 sekundi
              </li>
              <li>
                <Check aria-hidden="true" /> Prati popunjena mjesta
              </li>
              <li>
                <Check aria-hidden="true" /> Ponovo pozovi pouzdanu ekipu
              </li>
            </ul>
            <Link
              className={styles.lightAction}
              href="/login?intent=register&role=employer"
            >
              Objavi potrebu <ArrowUpRight aria-hidden="true" />
            </Link>
            <p className={styles.finePrint}>
              Brzina popunjavanja zavisi od dostupnih radnika u gradu.
            </p>
          </div>
        </section>
        <section className={styles.trust}>
          <div className={styles.trustLead}>
            <ShieldCheck aria-hidden="true" />
            <p className={styles.kicker}>02 / BEZ SITNIH SLOVA</p>
            <h2>
              Prvo jasno.
              <br />
              Onda brzo.
            </h2>
            <p>
              SMJENA ubrzava dogovor. Ne skriva šta potvrda znači i ne izmišlja
              povjerenje koje još nije zarađeno.
            </p>
          </div>
          <div className={styles.trustRows}>
            <details>
              <summary>
                Šta znači potvrda smjene?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Potvrdom zauzimaš mjesto i preuzimaš obavezu da dođeš. Prije
                otkazivanja vidiš posljedice po rezultat pouzdanosti.
              </p>
            </details>
            <details>
              <summary>
                Ko vidi moj broj telefona?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Druga strana ga vidi samo tokom aktivnog, potvrđenog angažmana.
                Ne prikazuje se u javnoj ponudi.
              </p>
            </details>
            <details>
              <summary>
                Kako se prati naknada?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Ukupan iznos vidiš prije potvrde. Nakon rada SMJENA evidentira
                obavezu i njen status, ali ne izvršava bankovnu uplatu.
              </p>
            </details>
            <details>
              <summary>
                Da li su svi nalozi verifikovani?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Ne. Oznaka verifikacije, ocjene i završeni angažmani prikazuju
                se samo kada za njih postoje stvarni podaci.
              </p>
            </details>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <PublicBrand />
        <p>Ljudi za smjenu. Smjena za ljude.</p>
        <Link href="/login">
          Uđi u SMJENU <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </footer>
    </div>
  );
}
