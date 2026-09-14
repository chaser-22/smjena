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
          <Link href="/shifts" className={styles.navAbout}>Oglasi</Link>
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
              Pronađi smjenu. Prijavi se. Izaberi ponudu.
              <br />
              Bez CV-a i dugog čekanja.
            </p>
            <div className={styles.heroActions}>
              <Link
                className={styles.primary}
                href="/shifts"
              >
                Pronađi smjenu <ArrowUpRight aria-hidden="true" />
              </Link>
              <Link
                className={styles.secondary}
                href="/employer/shifts"
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
                <h3>Prijavi se bez CV-a.</h3>
                <p>
                  Radnik šalje prijavu. Poslodavac pregleda prijave i bira kome
                  će poslati ponudu. Prijava ne rezerviše mjesto.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Znate šta slijedi.</h3>
                <p>
                  Radnik prihvata ili odbija ponudu. Kontakt se otkriva tek nakon
                  prihvatanja; zakonito angažovanje i plaćanje dogovarate direktno.
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
                <Check aria-hidden="true" /> Ti odlučuješ koju ponudu prihvataš
              </li>
              <li>
                <Check aria-hidden="true" /> Bez CV-a i naknade za radnike
              </li>
            </ul>
            <Link
              className={styles.primary}
              href="/shifts"
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
                <Check aria-hidden="true" /> Kratak oglas sa jasnim uslovima
              </li>
              <li>
                <Check aria-hidden="true" /> Prati popunjena mjesta
              </li>
              <li>
                <Check aria-hidden="true" /> Ti biraš koga želiš da angažuješ
              </li>
            </ul>
            <Link
              className={styles.lightAction}
              href="/employer/shifts"
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
                Da li prijava rezerviše mjesto?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Ne. Poslodavac pregleda prijave i šalje ponudu. Tek kada radnik
                prihvati, dogovor je potvrđen u aplikaciji. To nije potvrda ugovora,
                prijave radnika, dolaska ili plaćanja.
              </p>
            </details>
            <details>
              <summary>
                Ko vidi moj broj telefona?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Druga strana ga vidi nakon izbora i prihvatanja ponude, do kraja
                termina ili povlačenja/otkazivanja. Ne prikazuje se u javnom oglasu.
              </p>
            </details>
            <details>
              <summary>
                Ko plaća radnika?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Poslodavac. Ponuđeni iznos vidiš prije prijave. SMJENA ne obračunava
                zaradu, ne izvršava bankovnu uplatu i ne uzima procenat naknade radniku.
              </p>
            </details>
            <details>
              <summary>
                Da li su svi nalozi verifikovani?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Ne. Registracija nije provjera identiteta, sposobnosti za rad ili
                zakonitosti angažovanja. Poslodavac mora obaviti potrebne provjere.
              </p>
            </details>
          </div>
        </section>
      </main>
      <p className={styles.finePrint}>Nacrt objašnjenja odgovornosti: poslodavac je odgovoran za zakonit osnov angažovanja, prijavu radnika, dozvole, poreze, doprinose, uslove rada i plaćanje. Potrebno odobrenje pravnika u Crnoj Gori prije javnog lansiranja.</p>
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
