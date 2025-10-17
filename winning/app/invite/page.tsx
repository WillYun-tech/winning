'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function InvitePage() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No invite token provided');
      return;
    }

    (async () => {
      try {
        // Check if user is signed in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Redirect to login with the invite token preserved
          router.replace(`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`);
          return;
        }

        // Call the accept_invite RPC
        const { data: circleId, error } = await supabase.rpc('accept_invite', {
          p_token: token
        });

        if (error) {
          setStatus('error');
          setMessage(error.message);
          return;
        }

        if (circleId) {
          setStatus('success');
          setMessage('Successfully joined the circle!');
          // Redirect to the circle after a short delay
          setTimeout(() => {
            router.push(`/c/${circleId}`);
          }, 2000);
        } else {
          setStatus('error');
          setMessage('Invalid or expired invite');
        }
      } catch (err) {
        setStatus('error');
        setMessage('An error occurred while processing the invite');
        console.error(err);
      }
    })();
  }, [token, supabase, router]);

  if (status === 'loading') {
    return (
      <div>
        <h1>Processing Invite...</h1>
        <p>Please wait while we process your invite.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div>
        <h1>Invite Error</h1>
        <p>{message}</p>
        <button onClick={() => router.push('/circles')}>
          Go to Circles
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Welcome!</h1>
      <p>{message}</p>
      <p>Redirecting to the circle...</p>
    </div>
  );
}