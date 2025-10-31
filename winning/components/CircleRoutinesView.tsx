'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type CircleMember = {
  user_id: string;
  circle_id: string;
  joined_at: string;
  role: string;
};

type Routine = {
  id: string;
  user_id: string;
  circle_id: string | null;
  type: 'morning' | 'evening' | string;
  steps?: Array<{ id?: string; text: string; durationMinutes?: number | null; completedDates?: string[] }> | null;
  created_at?: string;
  updated_at?: string;
};

// We don't yet have a finalized schema for routines. This component
// renders a member list and gracefully handles missing data.
// When a schema is ready, we can populate the routines per member.

export default function CircleRoutinesView({ circleId }: { circleId: string }) {
  const supabase = createBrowserSupabaseClient();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberIdToRoutines, setMemberIdToRoutines] = useState<Record<string, Routine[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);

        const { data: memberRows, error: membersError } = await supabase
          .from('circle_members')
          .select('user_id, circle_id, joined_at, role')
          .eq('circle_id', circleId);

        if (membersError) {
          console.error('Error loading circle members:', membersError);
          setError(membersError.message || 'Failed to load members');
          setMembers([]);
        } else {
          setMembers(memberRows || []);
          // Load routines for all members in parallel (best-effort)
          if (memberRows && memberRows.length > 0) {
            const routinesMap: Record<string, Routine[]> = {};
            await Promise.all(
              memberRows.map(async (m) => {
                try {
                  const { data: routines, error: routinesError } = await supabase
                    .from('routines')
                    .select('id, user_id, circle_id, type, steps, created_at, updated_at')
                    .eq('user_id', m.user_id)
                    .is('circle_id', null)
                    .in('type', ['morning', 'evening'])
                    .order('created_at', { ascending: true });

                  if (routinesError) {
                    console.error(`Error loading routines for member ${m.user_id}:`, routinesError);
                    console.error('Error details:', {
                      code: routinesError.code,
                      message: routinesError.message,
                      details: routinesError.details,
                      hint: routinesError.hint
                    });
                    routinesMap[m.user_id] = [];
                  } else {
                    console.log(`Loaded ${routines?.length || 0} routines for member ${m.user_id}:`, routines);
                    routinesMap[m.user_id] = routines || [];
                  }
                } catch (e) {
                  console.warn('Unexpected routines fetch error:', e);
                  routinesMap[m.user_id] = [];
                }
              })
            );
            setMemberIdToRoutines(routinesMap);
          }
        }
      } catch (e: any) {
        console.error('Unexpected error loading routines view:', e);
        setError(e?.message || 'Unexpected error');
      } finally {
        setLoading(false);
      }
    })();
  }, [circleId, supabase]);

  function getDisplayName(userId: string): string {
    if (userId === currentUserId) return 'You';
    return `User ${userId.slice(0, 8)}`;
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading routines…</div>;
  if (error) return <div style={{ padding: '20px', color: 'var(--danger)' }}>Error: {error}</div>;

  if (!members || members.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        color: 'var(--text-muted)',
        backgroundColor: 'var(--paper)',
        borderRadius: '8px',
        border: '1px solid var(--border)'
      }}>
        <h3>No members yet</h3>
        <p>Invite others to your circle to view their routines.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {members.map((m) => (
        <div key={m.user_id} className="planner-card" style={{
          backgroundColor: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 4px 8px var(--shadow)'
        }}>
          {/* Member header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
            paddingBottom: '10px',
            borderBottom: '2px solid var(--border)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1.2rem'
            }}>
              {m.user_id.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 style={{
                margin: 0,
                fontSize: '1.4rem',
                color: 'var(--foreground)',
                fontFamily: 'Georgia, serif',
                fontWeight: 'bold'
              }}>
                {getDisplayName(m.user_id)}'s Routines
              </h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Role: {m.role}
              </p>
            </div>
          </div>

          {/* Routines content */}
          {(() => {
            const routines = memberIdToRoutines[m.user_id] || [];
            const morning = routines.find(r => (r.type || '').toLowerCase() === 'morning');
            const evening = routines.find(r => (r.type || '').toLowerCase() === 'evening');

            function deriveSteps(r?: Routine): string[] {
              if (!r || !r.steps) return [];
              // steps is a jsonb array of objects with text field
              if (Array.isArray(r.steps) && r.steps.length > 0) {
                return r.steps
                  .map(step => (step && typeof step.text === 'string') ? step.text.trim() : '')
                  .filter(text => text.length > 0);
              }
              return [];
            }

            const morningSteps = deriveSteps(morning);
            const eveningSteps = deriveSteps(evening);

            const sectionStyle = {
              backgroundColor: 'white',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '16px'
            } as const;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={sectionStyle}>
                  <h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--foreground)', fontFamily: 'Georgia, serif' }}>
                    🌅 Morning Routine
                  </h4>
                  {morningSteps.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontStyle: 'italic' }}>No morning routine shared.</p>
                  ) : (
                    <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--foreground)' }}>
                      {morningSteps.map((step, idx) => (
                        <li key={idx} style={{ marginBottom: '6px' }}>{step}</li>
                      ))}
                    </ol>
                  )}
                </div>

                <div style={sectionStyle}>
                  <h4 style={{ marginTop: 0, marginBottom: '10px', color: 'var(--foreground)', fontFamily: 'Georgia, serif' }}>
                    🌙 Evening Routine
                  </h4>
                  {eveningSteps.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontStyle: 'italic' }}>No evening routine shared.</p>
                  ) : (
                    <ol style={{ margin: 0, paddingLeft: '18px', color: 'var(--foreground)' }}>
                      {eveningSteps.map((step, idx) => (
                        <li key={idx} style={{ marginBottom: '6px' }}>{step}</li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      ))}
    </div>
  );
}


