import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json().catch(() => ({}));
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const { data: circle, error: insertErr } = await supabase
    .from('circles')
    .insert({ name, created_by: user.id })
    .select('id')
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });

  const { error: memberErr } = await supabase
    .from('circle_members')
    .insert({ circle_id: circle.id, user_id: user.id, role: 'owner' });

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 400 });

  return NextResponse.json({ id: circle.id }, { status: 201 });
}

