import CreateCircleForm from '@/components/CreateCircleForm';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';

export default async function CirclesPage() {
  const user = await requireUser();
  const supabase = await createServerSupabaseClient();

  const { data: memberships } = await supabase
    .from('circle_members')
    .select('circle_id, role, circles:circle_id ( id, name )')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  return (
    <div>
      <h1>Your circles</h1>
      <ul>
        {(memberships || []).map((m: any) => (
          <li key={m.circle_id}>
            <a href={`/c/${m.circles.id}`}>{m.circles.name}</a> — {m.role}
          </li>
        ))}
      </ul>

      <h2>Create a new circle</h2>
      <CreateCircleForm />

      {/* Placeholder join-by-token (to be implemented) */}
      <h3>Join by token (coming soon)</h3>
    </div>
  );
}