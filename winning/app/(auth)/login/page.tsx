'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const origin = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
    console.log('before signIn, pkce?', !!localStorage.getItem('sb-pkce-code-verifier'));
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: true }
    });
    console.log('after signIn, pkce?', !!localStorage.getItem('sb-pkce-code-verifier'), error?.message);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return <p>Check your email for the magic link.</p>;
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder="you@example.com"
      />
      <button type="submit">Send magic link</button>
      {error && <p>{error}</p>}
    </form>
  );
}