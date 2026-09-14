import styles from './marketplace.module.css';

export function EmployerResponsibility() {
  return <aside className={styles.notice}><strong>Radni tekst — potrebna je saglasnost pravnika u Crnoj Gori.</strong>
    <p>Poslodavac donosi odluku o angažovanju i odgovoran je za ugovor ili drugi zakonit osnov, prijavu radnika, dozvole, poreze, doprinose, obaveze na radnom mjestu i plaćanje. SMJENA ne zapošljava radnika, ne dodjeljuje ga automatski i ne isplaćuje zaradu. Prihvatanje u aplikaciji nije potvrda ispunjenosti tih obaveza.</p>
  </aside>;
}
