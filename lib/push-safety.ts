// Validate again at delivery, because a browser can write its own subscription
// directly through PostgREST. Never turn a stored endpoint into an arbitrary POST.
export function isTrustedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || value.length > 2048) return false;
    return url.hostname === 'fcm.googleapis.com'
      || url.hostname === 'updates.push.services.mozilla.com'
      || url.hostname.endsWith('.push.apple.com')
      || url.hostname.endsWith('.notify.windows.com');
  } catch { return false; }
}

export const applicationNotificationText: Record<string, string> = {
  applied: 'Stigla je nova prijava.', offered: 'Imaš novu ponudu. Provjeri rok za odgovor.',
  accepted: 'Radnik je prihvatio ponudu.', declined: 'Radnik je odbio ponudu.',
  withdrawn: 'Radnik je povukao prijavu ili prihvatanje.', rejected: 'Poslodavac nije izabrao tvoju prijavu.',
  cancelled: 'Poslodavac je povukao ponudu ili otkazao oglas.', expired: 'Rok za prijavu ili ponudu je istekao.',
};
