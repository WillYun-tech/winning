import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from './supabase/server';

export async function getUserSession() {
	const supabase = await createServerSupabaseClient();
	const { data, error } = await supabase.auth.getSession();
	if (error) throw error;
	return data.session ?? null;
}

export async function requireUser() {
	const session = await getUserSession();
	if (!session) redirect('/login');
	return session.user;
}