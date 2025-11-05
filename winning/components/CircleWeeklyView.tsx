'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type CircleMember = {
  user_id: string;
  circle_id: string;
  joined_at: string;
  role: string;
};

type ReviewRow = {
  id: string;
  user_id: string;
  circle_id: string | null;
  week_start: string;
  achievements: string | null;
  lessons: string | null;
  reflections: string | null;
  next_focus: string | null;
  top_outcomes: string | null;
  created_at: string;
  updated_at: string;
};

type Task = {
  id: string;
  user_id: string;
  circle_id: string | null;
  title: string;
  description: string | null;
  type: string | null;
  date: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  status: 'planned' | 'in_progress' | 'done' | 'open' | null;
  linked_goal_id: string | null;
  linked_milestone_id: string | null;
  created_at: string;
};

type MemberWeeklyData = {
  member: CircleMember;
  lastWeekReview: ReviewRow | null;
  thisWeekPlan: ReviewRow | null;
  tasks: Task[];
};

export default function CircleWeeklyView({ circleId }: { circleId: string }) {
  const supabase = createBrowserSupabaseClient();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberWeeklyData, setMemberWeeklyData] = useState<MemberWeeklyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState(() => getWeekStartLocal(new Date()));
  const currentWeekISO = useMemo(() => weekStart, [weekStart]);
  const prevWeekISO = useMemo(() => shiftWeek(currentWeekISO, -1), [currentWeekISO]);

  const headerLabel = useMemo(() => {
    const d = new Date(currentWeekISO + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, [currentWeekISO]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);

        // Load circle members
        const { data: memberRows, error: membersError } = await supabase
          .from('circle_members')
          .select('user_id, circle_id, joined_at, role')
          .eq('circle_id', circleId);

        if (membersError) {
          console.error('Error loading circle members:', membersError);
          setError(membersError.message || 'Failed to load members');
          setMembers([]);
          return;
        }

        setMembers(memberRows || []);

        // Load weekly data for all members
        if (memberRows && memberRows.length > 0) {
          const memberIds = memberRows.map(m => m.user_id);
          const weekEnd = weekEndFromStart(currentWeekISO);

          // Load reviews for last week and this week
          const { data: reviews, error: reviewsError } = await supabase
            .from('reviews')
            .select('*')
            .in('user_id', memberIds)
            .is('circle_id', null)
            .in('week_start', [prevWeekISO, currentWeekISO]);

          if (reviewsError) {
            console.error('Error loading reviews:', reviewsError);
            setError(`Failed to load reviews: ${reviewsError.message}`);
          }

          // Load tasks for this week
          const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .in('user_id', memberIds)
            .is('circle_id', null)
            .eq('type', 'week')
            .gte('date', currentWeekISO)
            .lte('date', weekEnd)
            .order('date', { ascending: true });

          if (tasksError) {
            console.error('Error loading tasks:', tasksError);
            setError(`Failed to load tasks: ${tasksError.message}`);
          }

          // Combine data by member
          const combinedData: MemberWeeklyData[] = memberRows.map(member => {
            const lastWeekReview = (reviews || []).find(
              r => r.user_id === member.user_id && r.week_start === prevWeekISO
            ) || null;
            const thisWeekPlan = (reviews || []).find(
              r => r.user_id === member.user_id && r.week_start === currentWeekISO
            ) || null;
            const memberTasks = (tasks || []).filter(t => t.user_id === member.user_id);

            return {
              member,
              lastWeekReview,
              thisWeekPlan,
              tasks: memberTasks
            };
          });

          setMemberWeeklyData(combinedData);
        }
      } catch (e: any) {
        console.error('Unexpected error loading weekly view:', e);
        setError(e?.message || 'Unexpected error');
      } finally {
        setLoading(false);
      }
    })();
  }, [circleId, currentWeekISO, prevWeekISO, supabase]);

  function getMemberInfo(userId: string): { name: string; color: string } {
    if (userId === currentUserId) {
      return { name: 'You', color: '#6b5b95' };
    }
    const member = members.find(m => m.user_id === userId);
    if (member) {
      const colors = [
        '#007bff', '#28a745', '#dc3545', '#ffc107',
        '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14'
      ];
      const colorIndex = parseInt(userId.slice(-1), 16) % colors.length;
      return {
        name: `User ${userId.slice(0, 8)}`,
        color: colors[colorIndex]
      };
    }
    return { name: 'Unknown', color: '#6c757d' };
  }

  function changeWeek(direction: 'prev' | 'next') {
    setWeekStart(prev => shiftWeek(prev, direction === 'next' ? 1 : -1));
  }

  function formatTopOutcomes(outcomes: string | string[] | null): string {
    if (!outcomes) return '';
    if (Array.isArray(outcomes)) return outcomes.join('\n');
    return outcomes;
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading weekly view...</div>;
  if (error) return <div style={{ padding: '20px', color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div>
      {/* Week Navigation */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: 'var(--paper)',
        border: '1px solid var(--border)',
        borderRadius: '8px'
      }}>
        <button
          onClick={() => changeWeek('prev')}
          className="planner-button"
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem'
          }}
        >
          ← Previous
        </button>
        <h3 style={{ 
          margin: 0, 
          color: 'var(--foreground)', 
          fontSize: '1.5rem',
          fontFamily: 'Georgia, serif',
          fontWeight: 'bold'
        }}>
          Week of {headerLabel}
        </h3>
        <button
          onClick={() => changeWeek('next')}
          className="planner-button"
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem'
          }}
        >
          Next →
        </button>
      </div>

      {/* Member Weekly Data */}
      {memberWeeklyData.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--paper)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <h3>No weekly data yet</h3>
          <p>Circle members haven't set up their weekly plans yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {memberWeeklyData.map((data) => {
            const memberInfo = getMemberInfo(data.member.user_id);
            return (
              <div key={data.member.user_id} className="planner-card" style={{
                backgroundColor: 'var(--paper)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 4px 8px var(--shadow)'
              }}>
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
                    backgroundColor: memberInfo.color,
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
                      {memberInfo.name}'s Week
                    </h3>
                  </div>
                </div>

                {/* Reviews and Plans */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  {/* Last Week Review */}
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <h4 style={{
                      marginTop: 0,
                      marginBottom: '12px',
                      color: 'var(--foreground)',
                      fontFamily: 'Georgia, serif',
                      fontSize: '1.1rem'
                    }}>
                      Last Week Review
                    </h4>
                    {data.lastWeekReview ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {data.lastWeekReview.achievements && (
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--foreground)', fontSize: '0.9rem' }}>Achievements / Wins</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{data.lastWeekReview.achievements}</div>
                          </div>
                        )}
                        {data.lastWeekReview.lessons && (
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--foreground)', fontSize: '0.9rem' }}>Lessons / Improvements</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{data.lastWeekReview.lessons}</div>
                          </div>
                        )}
                        {data.lastWeekReview.reflections && (
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--foreground)', fontSize: '0.9rem' }}>Reflections</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{data.lastWeekReview.reflections}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        No review for last week
                      </div>
                    )}
                  </div>

                  {/* This Week Plan */}
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <h4 style={{
                      marginTop: 0,
                      marginBottom: '12px',
                      color: 'var(--foreground)',
                      fontFamily: 'Georgia, serif',
                      fontSize: '1.1rem'
                    }}>
                      Plan This Week
                    </h4>
                    {data.thisWeekPlan ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {data.thisWeekPlan.next_focus && (
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--foreground)', fontSize: '0.9rem' }}>Focus Areas</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{data.thisWeekPlan.next_focus}</div>
                          </div>
                        )}
                        {data.thisWeekPlan.top_outcomes && (
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--foreground)', fontSize: '0.9rem' }}>Top 3 Outcomes</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{formatTopOutcomes(data.thisWeekPlan.top_outcomes)}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        No plan for this week
                      </div>
                    )}
                  </div>
                </div>

                {/* This Week's Tasks */}
                {data.tasks.length > 0 && (
                  <div style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}>
                    <h4 style={{
                      marginTop: 0,
                      marginBottom: '12px',
                      color: 'var(--foreground)',
                      fontFamily: 'Georgia, serif',
                      fontSize: '1.1rem'
                    }}>
                      This Week's Tasks
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      {(['planned', 'in_progress', 'done'] as const).map(col => {
                        const tasksInColumn = data.tasks.filter(t => (t.status || 'planned') === col);
                        return (
                          <div key={col}>
                            <div style={{
                              fontWeight: 'bold',
                              marginBottom: '8px',
                              color: 'var(--foreground)',
                              fontSize: '0.9rem'
                            }}>
                              {col === 'planned' ? 'Planned' : col === 'in_progress' ? 'In Progress' : 'Done'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {tasksInColumn.map(t => (
                                <div
                                  key={t.id}
                                  style={{
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    padding: '8px',
                                    backgroundColor: '#f8f9fa',
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  <div style={{ color: 'var(--foreground)', fontWeight: 'bold', marginBottom: '4px' }}>
                                    {t.title}
                                  </div>
                                  {t.date && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                      {t.date}
                                      {t.priority ? ` • ${t.priority}` : ''}
                                    </div>
                                  )}
                                  {t.description && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                                      {t.description}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {tasksInColumn.length === 0 && (
                                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem', padding: '8px' }}>
                                  None
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Helper functions
function getWeekStartLocal(d: Date): string {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay();
  const offsetToMonday = (day + 6) % 7;
  const start = new Date(dt);
  start.setDate(dt.getDate() - offsetToMonday);
  return isoLocal(start);
}

function shiftWeek(weekStartISO: string, weeks: number): string {
  const [y, m, da] = weekStartISO.split('-').map(Number);
  const d = new Date(y, m - 1, da);
  d.setDate(d.getDate() + weeks * 7);
  return isoLocal(d);
}

function weekEndFromStart(weekISO: string): string {
  const [y, m, d] = weekISO.split('-').map(Number);
  const end = new Date(y, m - 1, d);
  end.setDate(end.getDate() + 6);
  return isoLocal(end);
}

function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

