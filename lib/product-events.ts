import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

export type ProductEventName =
  | 'availability_enabled'
  | 'notifications_enabled'
  | 'shift_claimed'
  | 'shift_checked_in'
  | 'shift_checked_out'
  | 'shift_cancelled'
  | 'shift_published'
  | 'shift_broadcast'
  | 'shift_pay_raised'
  | 'replacement_requested'
  | 'worker_rated'
  | 'shift_cancelled_by_employer'
  | 'payment_authorized'
  | 'worker_marked_no_show';

type ProductEvent = {
  userId: string;
  actorRole: 'worker' | 'employer';
  eventName: ProductEventName;
  subjectId?: string;
  employerId?: string;
  source?: 'dashboard' | 'push';
};

export async function recordProductEvent(event: ProductEvent) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('product_events').insert({
      user_id: event.userId,
      actor_role: event.actorRole,
      employer_id: event.employerId ?? null,
      event_name: event.eventName,
      subject_id: event.subjectId ?? null,
      source: event.source ?? 'dashboard',
    });
    if (error) console.error('Product event was not recorded:', error.code);
  } catch (error) {
    console.error('Product event service is unavailable:', error instanceof Error ? error.message : 'unknown error');
  }
}
