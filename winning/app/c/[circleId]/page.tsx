'use client';

import { useParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CirclePage() {
  const params = useParams();
  const circleId = params.circleId as string;
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Check if user is a member of this circle
      const { data: membership } = await supabase
        .from('circle_members')
        .select('role')
        .eq('circle_id', circleId)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        // Not a member - redirect away
        router.push('/circles');
        return;
      }

      // User is a member - load circle data
      const { data, error } = await supabase
        .from('circles')
        .select('id, name, created_at')
        .eq('id', circleId)
        .single();
      
      if (error) {
        console.error(error);
        return;
      }
      setCircle(data);
      setLoading(false);
    })();
  }, [circleId, supabase, router]);

  async function createInvite() {
    setCreatingInvite(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { data, error } = await supabase
      .from('circle_invites')
      .insert({
        circle_id: circleId,
        inviter_id: user.id,
        role: 'member',
        token,
        expires_at: expiresAt.toISOString()
      })
      .select('token')
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setInviteToken(data.token);
    setCreatingInvite(false);
  }

  async function leaveCircle() {
    if (!confirm('Are you sure you want to leave this circle?')) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', user.id);

    if (error) {
      console.error(error);
      return;
    }

    window.location.href = '/circles';
  }

  function copyInviteLink() {
    const link = `${window.location.origin}/invite?token=${inviteToken}`;
    navigator.clipboard.writeText(link);
    alert('Invite link copied to clipboard!');
  }

  if (loading) return <p>Loading circle...</p>;
  if (!circle) return <p>Circle not found</p>;

  return (
    <div>
      <h1>{circle.name}</h1>
      <p>Circle ID: {circle.id}</p>
      <p>Created: {new Date(circle.created_at).toLocaleDateString()}</p>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Invite Members</h2>
        {!inviteToken ? (
          <button onClick={createInvite} disabled={creatingInvite}>
            {creatingInvite ? 'Creating...' : 'Create Invite Link'}
          </button>
        ) : (
          <div>
            <p>Invite link created! Share this link:</p>
            <input 
              value={`${window.location.origin}/invite?token=${inviteToken}`} 
              readOnly 
              style={{ width: '400px', marginRight: '10px' }}
            />
            <button onClick={copyInviteLink}>Copy Link</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={leaveCircle}
          style={{ backgroundColor: 'red', color: 'white', padding: '8px 16px' }}
        >
          Leave Circle
        </button>
      </div>
    </div>
  );
}