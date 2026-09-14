'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isTrustedPushEndpoint } from '@/lib/push-safety';

export async function setApplicationPush(enabled: boolean, subscription?: PushSubscriptionJSON) {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { error: 'Prijavi se ponovo.' };
  if (typeof enabled !== 'boolean') return { error: 'Izbor nije ispravan.' };
  if (enabled) {
    const parsed = z.object({ endpoint: z.string().max(2048), keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(10).max(100) }) }).safeParse(subscription);
    if (!parsed.success || !isTrustedPushEndpoint(parsed.data.endpoint)) return { error: 'Ovaj servis obavijesti još nije podržan.' };
    const saved = await client.from('push_subscriptions').upsert({ user_id: data.user.id, endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh, auth_secret: parsed.data.keys.auth, updated_at: new Date().toISOString() }, { onConflict: 'user_id,endpoint' });
    if (saved.error) return { error: 'Pretplata nije sačuvana. Pokušaj ponovo.' };
  }
  const preference = await client.from('notification_preferences').upsert({ user_id: data.user.id, application_push: enabled }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (preference.error) return { error: 'Podešavanje nije sačuvano.' };
  const updated = await client.from('notification_preferences').update({ application_push: enabled }).eq('user_id', data.user.id);
  if (updated.error) return { error: 'Podešavanje nije sačuvano.' };
  revalidatePath('/notifications');
  return { enabled };
}

export async function markNotificationRead(id: string) {
  if (!z.uuid().safeParse(id).success) return;
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return;
  const result = await client.from('marketplace_notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('recipient_id', data.user.id);
  if (result.error) throw new Error('Obavijest nije označena. Pokušaj ponovo.');
  revalidatePath('/notifications');
}
