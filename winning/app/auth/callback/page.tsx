'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function AuthCallback() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  useEffect(() => {
    // detectSessionInUrl=true lets the SDK parse the hash and set the session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        // Redirect to the intended destination or default to circles
        router.replace(next || '/circles');
      } else {
        router.replace('/login?error=invalid-link');
      }
    });
  }, [router, supabase, next]);

  return <p>Signing you in…</p>;
}