import { createAdminClient } from '@/lib/supabase/admin';
import { handlePushWakeup } from '@/lib/application-push-worker';
import { runApplicationNotificationBatch } from '@/lib/application-notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  return handlePushWakeup(request, async (token) => {
    const { data, error } = await createAdminClient().rpc('consume_application_push_wakeup', { wake_token: token });
    if (error) throw new Error('Wake-up authorization unavailable');
    return data === true;
  }, runApplicationNotificationBatch);
}
