'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type CircleMember = {
  user_id: string;
  circle_id: string;
  joined_at: string;
  role: string;
};

export default function CircleMembersView({ circleId }: { circleId: string }) {
  const supabase = createBrowserSupabaseClient();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
      loadCircleMembers();
    })();
  }, [circleId]);

  async function loadCircleMembers() {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('User not authenticated:', authError);
        setError('Please log in to view circle members');
        return;
      }

      console.log('Current User ID:', user.id);
      console.log('Circle ID:', circleId);

      const { data, error: membersError } = await supabase
        .from('circle_members')
        .select(`
          user_id,
          circle_id,
          joined_at,
          role
        `)
        .eq('circle_id', circleId);

      if (membersError) {
        console.error('Error loading circle members:', membersError);
        setError(`Failed to load circle members: ${membersError.message || 'Unknown error'}`);
        return;
      }

      setMembers(data || []);
      console.log('Loaded members:', data);

      // Simple fallback: generate display names from user IDs for now
      if (data && data.length > 0) {
        const profileMap: Record<string, string> = {};
        data.forEach((member) => {
          if (member.user_id === currentUserId) {
            profileMap[member.user_id] = 'You';
          } else {
            // Generate a simple name from user ID
            const shortId = member.user_id.slice(0, 8);
            profileMap[member.user_id] = `User ${shortId}`;
          }
        });
        
        setUserProfiles(profileMap);
      }

    } catch (err: any) {
      console.error('Unexpected error in loadCircleMembers:', err);
      setError(`An unexpected error occurred: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading circle members...</div>;
  if (error) return <div style={{ padding: '20px', color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '10px' }}>
        Current User ID: <strong style={{ color: 'var(--foreground)' }}>{currentUserId}</strong><br/>
        Circle ID: <strong style={{ color: 'var(--foreground)' }}>{circleId}</strong><br/>
        Total Members: <strong style={{ color: 'var(--foreground)' }}>{members.length}</strong>
      </div>

      {members.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No members found in this circle.
        </div>
      ) : (
        members.map(member => (
          <div key={member.user_id} style={{
            backgroundColor: member.user_id === currentUserId ? 'rgba(107, 91, 149, 0.1)' : 'var(--background)',
            border: member.user_id === currentUserId ? '1px solid var(--accent)' : '1px solid var(--border)',
            borderRadius: '8px',
            padding: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            boxShadow: '0 1px 3px var(--shadow)'
          }}>
            <div style={{
              width: '45px',
              height: '45px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1.3rem'
            }}>
              {member.user_id.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 style={{ margin: 0, color: 'var(--foreground)', fontSize: '1.1rem' }}>
                {member.user_id === currentUserId 
                  ? 'You' 
                  : userProfiles[member.user_id] || 'Unknown User'
                }
              </h4>
              <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Joined: {new Date(member.joined_at).toLocaleDateString()} | Role: {member.role}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}