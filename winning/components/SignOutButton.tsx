'use client';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function SignOutButton() {
  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient(); // constructed when needed
    await supabase.auth.signOut();
  }
  return <button onClick={handleSignOut}>Sign out</button>;
}