'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function AuthCallback() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();

  useEffect(() => {
    // detectSessionInUrl=true lets the SDK parse the hash and set the session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/circles');
      else router.replace('/login?error=invalid-link');
    });
  }, [router, supabase]);

  return <p>Signing you in…</p>;
}