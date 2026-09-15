import { z } from 'zod';

export const jobRoles = ['Konobar', 'Šanker', 'Kuvar', 'Pomoćni radnik', 'Recepcioner', 'Sobarica'] as const;
export const locationAreas = ['Centar', 'Stari grad', 'Obala', 'Širi centar', 'Drugi dio grada'] as const;
export const jobRequirements = ['Iskustvo u ugostiteljstvu', 'Rad sa POS kasom', 'Engleski jezik', 'Crna košulja', 'Bijela košulja', 'Zatvorena obuća'] as const;
export const applicationStatuses = ['applied', 'offered', 'accepted', 'declined', 'withdrawn', 'expired', 'rejected', 'cancelled'] as const;
export type ApplicationStatus = typeof applicationStatuses[number];
export const statusLabels: Record<ApplicationStatus, string> = {
  applied: 'Prijava poslata', offered: 'Ponuda čeka odgovor', accepted: 'Ponuda prihvaćena', declined: 'Ponuda odbijena',
  withdrawn: 'Prijava povučena', expired: 'Rok je istekao', rejected: 'Poslodavac nije izabrao prijavu', cancelled: 'Otkazano',
};
export const decisions = ['offer', 'reject', 'revoke', 'accept', 'decline', 'withdraw'] as const;
export type ApplicationDecision = typeof decisions[number];
export type MarketplaceResult = { error?: string; message?: string; href?: string };
export const PublishApplicationSchema = z.object({
  workspace: z.uuid(), requestId: z.uuid(), publicName: z.string().trim().min(2).max(120),
  role: z.enum(jobRoles), area: z.enum(locationAreas), address: z.string().trim().min(2).max(200),
  start: z.string(), end: z.string(), compensation: z.coerce.number().min(20).max(5000),
  places: z.coerce.number().int().min(1).max(50), requirements: z.array(z.enum(jobRequirements)).max(8), confirmed: z.literal(true),
});

// Montenegro has UTC+1/+2. Reject missing/repeated DST wall times rather than
// silently publishing at a different time, regardless of the operator's device.
export function montenegroInstant(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const nominal = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(nominal)) return null;
  const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Podgorica', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const matches = [60, 120].map((minutes) => new Date(nominal - minutes * 60000))
    .filter((date) => formatter.format(date).replace(' ', 'T') === value);
  return matches.length === 1 ? matches[0].toISOString() : null;
}

export function applicationError(message: string): string {
  if (/Billing owner required/.test(message)) return 'Samo vlasnik naloga firme može koristiti kredite.';
  if (/Posting credit confirmation required/.test(message)) return 'Uslovi objavljivanja su promijenjeni. Osvježi formu i potvrdi korišćenje kredita.';
  if (/Standard posting credit required/.test(message)) return 'Nema važećeg kredita za standardnu objavu. Otvori pregled kredita firme.';
  if (/SOS already active/.test(message)) return 'Ovaj oglas već ima aktivnu SOS promociju. Drugi kredit nije potrošen.';
  if (/SOS duration exceeds/.test(message)) return 'Do početka smjene nema dovoljno vremena za cijelo trajanje ovog SOS kredita.';
  if (/SOS credit unavailable|Posting credit unavailable|Posting credit exhausted/.test(message)) return 'Kredit više nije dostupan ili su mu promijenjeni uslovi. Osvježi pregled kredita.';
  if (/Credit request mismatch/.test(message)) return 'Ovaj pokušaj pripada drugoj operaciji. Osvježi stanje prije nastavka.';
  if (/Not authorized/.test(message)) return 'Nemaš pristup ovoj prijavi ili firmi. Osvježi stranicu.';
  if (/Pilot not enabled/.test(message)) return 'Novi oglasi još nijesu omogućeni za ovu firmu.';
  if (/Worker profile is required/.test(message)) return 'Prvo dodaj radnički profil u podešavanjima.';
  if (/contact phone/.test(message)) return 'Dodaj kontakt telefon prije nastavka. Neće biti javan.';
  if (/No offer capacity/.test(message)) return 'Sva mjesta su prihvaćena ili čekaju odgovor na ponudu. Sačekaj ili povuci postojeću ponudu.';
  if (/Overlapping commitment/.test(message)) return 'Već imaš prihvaćenu smjenu u ovom terminu. Ovu ponudu ne možeš prihvatiti.';
  if (/Cannot apply to own/.test(message)) return 'Ne možeš se prijaviti za smjenu firme kojoj pripadaš.';
  if (/Invitation unavailable/.test(message)) return 'Poziv nije dostupan. Radnik možda ne prima pozive, već ima prijavu ili nije među omiljenima ove firme.';
  if (/Previous accepted shift required/.test(message)) return 'Radnika možeš sačuvati nakon isteka termina ranije prihvaćene smjene. To nije potvrda dolaska.';
  if (/rate limit/i.test(message)) return 'Dostignut je dnevni limit. Pokušaj sjutra.';
  if (/Invalid public/.test(message)) return 'Provjeri vrijeme, iznos i javni naziv. Ne unosi telefon, email ili web adresu u javni naziv.';
  if (/Shift unavailable|Shift cancelled|Shift already started|Invalid application state/.test(message)) return 'Status se promijenio ili je rok istekao. Osvježi stranicu prije nastavka.';
  return 'Akcija nije potvrđena. Provjeri vezu i pokušaj ponovo.';
}
