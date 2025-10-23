'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type CircleMember = {
  user_id: string;
  circle_id: string;
  joined_at: string;
  role: string;
};

type Goal = {
  id: string;
  title: string;
  description: string;
  horizon: 'long-term' | 'medium-term' | 'short-term';
  deadline: string | null;
  why: string | null;
  action_plan: string | null;
  strategy_notes: string | null;
  created_at: string;
  milestones: Milestone[];
};

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  due_week: string | null;
  completed: boolean;
  completed_at: string | null;
};

type MemberGoals = {
  member: CircleMember;
  goals: Goal[];
};

export default function CircleGoalsView({ circleId }: { circleId: string }) {
  const supabase = createBrowserSupabaseClient();
  const [memberGoals, setMemberGoals] = useState<MemberGoals[]>([]);
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
    })();
    loadCircleGoals();
  }, [circleId]);

  // Helper function to get display name from email (keeping for potential future use)
  function getDisplayName(email: string): string {
    if (!email) return 'Unknown User';
    const name = email.split('@')[0];
    // Convert willandmark6 to "Will" or similar
    const cleanName = name.replace(/[0-9]/g, '').toLowerCase();
    return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  }

  async function loadCircleGoals() {
    try {
      setLoading(true);
      setError(null);

      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('User not authenticated:', authError);
        setError('Please log in to view circle goals');
        return;
      }
      console.log('User authenticated:', user.email);

      // Get circle members
      console.log('Loading circle members for circleId:', circleId);
      const { data: members, error: membersError } = await supabase
        .from('circle_members')
        .select(`
          user_id,
          circle_id,
          joined_at,
          role
        `)
        .eq('circle_id', circleId);

      console.log('Circle members query result:', { members, membersError });

      if (membersError) {
        console.error('Error loading circle members:', membersError);
        console.error('Full error object:', JSON.stringify(membersError, null, 2));
        setError(`Failed to load circle members: ${membersError.message || 'Unknown error'}`);
        return;
      }

      if (!members || members.length === 0) {
        setMemberGoals([]);
        setLoading(false);
        return;
      }

      // Simple fallback: generate display names from user IDs for now
      const profileMap: Record<string, string> = {};
      members.forEach((member, index) => {
        if (member.user_id === currentUserId) {
          profileMap[member.user_id] = 'You';
        } else {
          // Generate a simple name from user ID
          const shortId = member.user_id.slice(0, 8);
          profileMap[member.user_id] = `User ${shortId}`;
        }
      });
      
      setUserProfiles(profileMap);

      const memberGoalsData: MemberGoals[] = [];
      for (const member of members) {
        // Fetch personal goals for each member
        const { data: goals, error: goalsError } = await supabase
          .from('goals')
          .select(`
            id,
            title,
            description,
            horizon,
            deadline,
            why,
            action_plan,
            strategy_notes,
            created_at,
            milestones (*)
          `)
          .eq('user_id', member.user_id)
          .is('circle_id', null) // Personal goals only
          .order('created_at', { ascending: false });

        if (goalsError) {
          console.error(`Error loading goals for member ${member.user_id}:`, goalsError);
          continue; // Skip this member but continue with others
        }

        memberGoalsData.push({
          member,
          goals: goals || []
        });
      }
      setMemberGoals(memberGoalsData);
    } catch (err: any) {
      console.error('Unexpected error in loadCircleGoals:', err);
      setError(`An unexpected error occurred: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading circle goals...</div>;
  if (error) return <div style={{ padding: '20px', color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {memberGoals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          No members in this circle have set personal goals yet.
        </div>
      ) : (
        memberGoals.map((data) => (
          <div key={data.member.user_id} style={{ marginBottom: '40px' }}>
            {/* Member Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              marginBottom: '20px',
              paddingBottom: '12px',
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
                {data.member.user_id.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '1.4rem', 
                  color: 'var(--foreground)',
                  fontFamily: 'Georgia, serif',
                  fontWeight: 'bold'
                }}>
                  {data.member.user_id === currentUserId 
                    ? 'Your Goals' 
                    : `${userProfiles[data.member.user_id] || 'Unknown User'}'s Goals`
                  }
                </h3>
                <p style={{ 
                  margin: 0, 
                  color: 'var(--text-muted)', 
                  fontSize: '0.9rem' 
                }}>
                  {data.goals.length} goal{data.goals.length !== 1 ? 's' : ''} total
                </p>
              </div>
            </div>

            {/* Goals List - Same design as personal planner */}
            {data.goals.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: 'var(--text-muted)', 
                fontStyle: 'italic',
                backgroundColor: '#f9f9f9',
                borderRadius: '8px',
                border: '1px solid #e0e0e0'
              }}>
                <h3>No goals yet</h3>
                <p>This member hasn't set any personal goals yet.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '24px' }}>
                {data.goals.map((goal) => (
                  <div key={goal.id} className="planner-card" style={{
                    backgroundColor: 'var(--paper)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '24px',
                    boxShadow: '0 4px 8px var(--shadow)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                      <div>
                        <h3 style={{ 
                          margin: '0 0 8px 0', 
                          fontSize: '1.6rem', 
                          color: 'var(--foreground)', 
                          fontWeight: 'bold',
                          fontFamily: 'Georgia, serif'
                        }}>
                          {goal.title}
                        </h3>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                          <span style={{
                            backgroundColor: goal.horizon === 'long-term' ? 'var(--accent)' : goal.horizon === 'medium-term' ? 'var(--warning)' : 'var(--success)',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {goal.horizon.replace('-', ' ')}
                          </span>
                          {goal.deadline && (
                            <span style={{ 
                              color: 'var(--text-muted)', 
                              fontSize: '0.9rem',
                              fontStyle: 'italic',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              📅 Due: {new Date(goal.deadline).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {goal.description && (
                      <p style={{ margin: '0 0 15px 0', color: '#333' }}>{goal.description}</p>
                    )}

                    {goal.why && (
                      <div style={{ marginBottom: '15px' }}>
                        <strong style={{ color: '#000' }}>Why:</strong> <span style={{ color: '#333' }}>{goal.why}</span>
                      </div>
                    )}

                    {goal.action_plan && (
                      <div style={{ marginBottom: '15px' }}>
                        <strong style={{ color: '#000' }}>Action Plan:</strong> <span style={{ color: '#333' }}>{goal.action_plan}</span>
                      </div>
                    )}

                    {goal.strategy_notes && (
                      <div style={{ marginBottom: '15px' }}>
                        <strong style={{ color: '#000' }}>Strategy Notes:</strong> <span style={{ color: '#333' }}>{goal.strategy_notes}</span>
                      </div>
                    )}

                    {/* Milestones */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, color: '#000', fontWeight: 'bold' }}>Milestones</h4>
                      </div>

                      {goal.milestones.length === 0 ? (
                        <p style={{ color: '#666', fontStyle: 'italic' }}>No milestones yet</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {goal.milestones.map((milestone) => (
                            <div key={milestone.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px',
                              backgroundColor: 'white',
                              borderRadius: '4px',
                              border: '1px solid #e0e0e0'
                            }}>
                              <input
                                type="checkbox"
                                checked={milestone.completed}
                                disabled={true} // Read-only in circle view
                                style={{ cursor: 'not-allowed' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ 
                                  fontWeight: 'bold', 
                                  textDecoration: milestone.completed ? 'line-through' : 'none', 
                                  color: '#000' 
                                }}>
                                  {milestone.title}
                                </div>
                                {milestone.description && (
                                  <div style={{ fontSize: '0.9rem', color: '#666' }}>{milestone.description}</div>
                                )}
                                {milestone.due_week && (
                                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                    Due: {new Date(milestone.due_week).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}