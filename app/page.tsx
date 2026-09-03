import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  if (!isSupabaseConfigured()) redirect('/login');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? '/dashboard' : '/login');
}
