'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type Membership = { circle_id: string; role: string; circles: { id: string; name: string } };

export default function CirclesPage() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      const { data, error } = await supabase
        .from('circle_members')
        .select('circle_id, role, circles:circle_id ( id, name )')
        .eq('user_id', session.user.id)
        .order('joined_at', { ascending: false });
      if (!mounted) return;
      if (error) setError(error.message);
      setMemberships((data as any) || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [router, supabase]);

  // app/circles/page.tsx
    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
    
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.replace('/login');
    
        const { data: circle, error: e1 } = await supabase
        .from('circles')
        .insert({ name, created_by: user.id })
        .select('id')
        .single();
        if (e1) return setError(e1.message);
    
        const { error: e2 } = await supabase
        .from('circle_members')
        .insert({ circle_id: circle.id, user_id: user.id, role: 'owner' });
        if (e2) return setError(e2.message);
    
        router.push(`/c/${circle.id}`);
    }

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Your circles</h1>
      {error && <p>{error}</p>}
      <ul>
        {memberships.map((m) => (
          <li key={m.circle_id}>
            <a href={`/c/${m.circles.id}`}>{m.circles.name}</a> — {m.role}
          </li>
        ))}
      </ul>

      <h2>Create a new circle</h2>
      <form onSubmit={onCreate}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Circle name" required />
        <button type="submit">Create</button>
      </form>
    </div>
  );
}