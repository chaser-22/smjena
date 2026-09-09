import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Check, ArrowRight } from 'lucide-react';
import { PublicBrand } from './public-brand';
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
          <div>
            <p className={styles.kicker}>
              <span className={styles.signalDot} /> UGOSTITELJSTVO. CRNA GORA.
            </p>
            <h1 id="hero-title">
              Tvoj grad.
              <br />
              Tvoja sljedeća
              <br />
              <span>SMJENA.</span>
            </h1>
            <p className={styles.heroDescription}>
              Slobodan dan pretvori u radni.
              <br />
              Pronađi ugostiteljsku smjenu, vidi uslove i potvrdi svoje mjesto.
              Bez CV-a.
            </p>
            <Link
              className={styles.primary}
              href="/login?intent=register&role=worker"
            >
              Pronađi smjenu <ArrowUpRight aria-hidden="true" />
            </Link>
            <p className={styles.returning}>
              Već imaš nalog? <Link href="/login">Prijavi se</Link>
            </p>
            <Link
              className={styles.employerEntry}
              href="/login?intent=register&role=employer"
            >
              Treba ti radnik? <strong>Pronađi radnika</strong>{' '}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.poster}>
            <div className={styles.posterTop}>
              <span>ZA LJUDE KOJI POKREĆU GRAD.</span>
              <span>ME / 01</span>
            </div>
            <div className={styles.sign} aria-hidden="true">
              <span>IMA</span>
              <span>
                POSLA<span className={styles.signStar}>✳</span>
              </span>
            </div>
            <figure className={styles.ticket}>
              <figcaption>
                KAKO FUNKCIONIŠE SMJENA{' '}
                <ArrowUpRight size={17} aria-hidden="true" />
              </figcaption>
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <strong>Pojavi se potreba.</strong>
                    <small>Lokal objavi smjenu i uslove.</small>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Pronađeš svoj termin.</strong>
                    <small>Provjeriš naknadu, vrijeme i lokaciju.</small>
                  </div>
                </li>
                <li>
                  <span className={styles.ticketCheck}>
                    <Check size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Potvrdiš. Znate na čemu ste.</strong>
                    <small>Mjesto je rezervisano. Kontakt je dostupan.</small>
                  </div>
                </li>
              </ol>
              <div className={styles.ticketBottom}>
                JASNI USLOVI. DIREKTAN DOGOVOR.
                <span aria-hidden="true">|||| ||| || |||||</span>
              </div>
            </figure>
            <p className={styles.posterFoot}>
              OD PRVE KAFE DO POSLJEDNJEG GOSTA.
            </p>
          </div>
        </section>
        <div className={styles.tradeStrip} aria-label="Ugostiteljske uloge">
          <span>ZA ŠANKOM</span>
          <span aria-hidden="true">✳</span>
          <span>U SALI</span>
          <span aria-hidden="true">✳</span>
          <span>U KUHINJI</span>
          <span aria-hidden="true">✳</span>
          <span>U HOTELU</span>
        </div>
        <section id="kako-radi" className={styles.how}>
          <div className={styles.sectionHeading}>
            <p className={styles.kicker}>MANJE DOPISIVANJA. VIŠE DOGOVORA.</p>
            <h2>
              Od „mogu danas“
              <br />
              do „vidimo se“.
            </h2>
            <ArrowDown aria-hidden="true" />
          </div>
          <ol className={styles.steps}>
            <li>
              <span>01 / PRONAĐI</span>
              <h3>Vidi cijelu sliku.</h3>
              <p>
                Ukupna naknada, tačno vrijeme, lokacija i uslovi. Sve prije
                tvoje odluke.
              </p>
            </li>
            <li>
              <span>02 / POTVRDI</span>
              <h3>Uzmi svoje mjesto.</h3>
              <p>
                Potvrda rezerviše mjesto i obavezuje te na dolazak. Dobijaš
                kontakt poslodavca za dogovor.
              </p>
            </li>
            <li>
              <span>03 / ODRADI</span>
              <h3>Gradi svoju ekipu.</h3>
              <p>
                Evidentiraj dolazak i završetak. Završene smjene i ocjene
                otvaraju vrata ponovnom angažmanu.
              </p>
            </li>
          </ol>
        </section>
        <section className={styles.business}>
          <div>
            <p className={styles.kicker}>ZA LOKALE, RESTORANE I HOTELE</p>
            <h2>
              Gosti stižu.
              <br />
              <span>Fali ti čovjek?</span>
            </h2>
            <Link
              className={styles.primary}
              href="/login?intent=register&role=employer"
            >
              Pronađi radnika <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.businessCopy}>
            <p>
              Objavi šta treba, kada i za koliko.
              <br />
              Tvoja sljedeća smjena počinje jasnim dogovorom.
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" /> Prati svako popunjeno mjesto.
              </li>
              <li>
                <Check aria-hidden="true" /> Prvo pozovi ljude koje želiš
                ponovo.
              </li>
              <li>
                <Check aria-hidden="true" /> Oslobođeno mjesto vrati u mrežu.
              </li>
            </ul>
            <p className={styles.finePrint}>
              Brzina pronalaska zavisi od dostupnih radnika u tvom gradu.
            </p>
          </div>
        </section>
        <section className={styles.trust}>
          <div>
            <p className={styles.kicker}>POVJERENJE SE ZARAĐUJE.</p>
            <h2>
              Jasno prije.
              <br />
              Jasno poslije.
            </h2>
          </div>
          <div className={styles.trustRows}>
            <details>
              <summary>
                Šta znači potvrda smjene?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Potvrdom zauzimaš mjesto i preuzimaš obavezu da dođeš. Prije
                otkazivanja vidiš posljedice po svoj rezultat pouzdanosti. Za
                promjenu dogovora kontaktiraj drugu stranu.
              </p>
            </details>
            <details>
              <summary>
                Ko vidi moj broj telefona?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Kontakt telefon služi dogovoru oko potvrđene smjene. Druga
                strana ga vidi tokom aktivnog angažmana. Ne prikazuje se u
                javnoj ponudi.
              </p>
            </details>
            <details>
              <summary>
                Kako se prati naknada?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Ukupan iznos vidiš prije potvrde. Nakon završetka, SMJENA vodi
                evidenciju obaveze i njenog statusa. Evidencija sama ne izvršava
                bankovnu uplatu. Isplatu dogovaraš sa poslodavcem.
              </p>
            </details>
            <details>
              <summary>
                Da li su svi nalozi verifikovani?
                <ArrowRight aria-hidden="true" />
              </summary>
              <p>
                Ne. Oznaka verifikacije prikazuje se samo uz verifikovan nalog.
                Ocjene i završeni angažmani prikazuju se kada postoje podaci o
                njima.
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
