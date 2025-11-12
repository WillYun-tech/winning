'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type CircleMember = {
  user_id: string;
  circle_id: string;
  joined_at: string;
  role: string;
};

type DayNotesRow = {
  user_id: string;
  circle_id: string | null;
  date: string;
  schedule: string | null;
  notes: string | null;
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
  status: 'planned' | 'in_progress' | 'done' | null;
  created_at: string;
};

type MemberDailyData = {
  member: CircleMember;
  priority: Task | null;
  schedule: string | null;
  notes: string | null;
  todos: Task[];
};

export default function CircleDailyView({ circleId }: { circleId: string }) {
  const supabase = createBrowserSupabaseClient();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberDailyData, setMemberDailyData] = useState<MemberDailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(() => isoLocal(new Date()));

  const headerLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }, [selectedDate]);

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
          return;
        }

        setMembers(memberRows || []);

        if (memberRows && memberRows.length > 0) {
          const memberIds = memberRows.map(m => m.user_id);

          const { data: dayNotes, error: notesError } = await supabase
            .from('day_notes')
            .select('user_id, circle_id, date, schedule, notes')
            .in('user_id', memberIds)
            .is('circle_id', null)
            .eq('date', selectedDate);

          if (notesError) {
            console.error('Error loading day notes:', notesError);
            setError(`Failed to load schedules: ${notesError.message}`);
          }

          const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .in('user_id', memberIds)
            .is('circle_id', null)
            .eq('date', selectedDate)
            .in('type', ['priority', 'task'])
            .order('created_at', { ascending: true });

          if (tasksError) {
            console.error('Error loading daily tasks:', tasksError);
            setError(`Failed to load daily tasks: ${tasksError.message}`);
          }

          const combined: MemberDailyData[] = memberRows.map(member => {
            const memberNotes = (dayNotes || []).find(n => n.user_id === member.user_id) || null;
            const memberTasks = (tasks || []).filter(t => t.user_id === member.user_id);
            const priority = memberTasks.find(t => t.type === 'priority') || null;
            const todos = memberTasks.filter(t => t.type === 'task');

            return {
              member,
              priority,
              schedule: memberNotes?.schedule ?? null,
              notes: memberNotes?.notes ?? null,
              todos
            };
          });

          setMemberDailyData(combined);
        } else {
          setMemberDailyData([]);
        }
      } catch (e: any) {
        console.error('Unexpected error loading circle daily view:', e);
        setError(e?.message || 'Unexpected error');
      } finally {
        setLoading(false);
      }
    })();
  }, [circleId, selectedDate, supabase]);

  function getMemberInfo(userId: string): { name: string; color: string } {
    if (userId === currentUserId) {
      return { name: 'You', color: '#6b5b95' };
    }
    const member = members.find(m => m.user_id === userId);
    if (member) {
      const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#e83e8c', '#fd7e14'];
      const colorIndex = parseInt(userId.slice(-1), 16) % colors.length;
      return {
        name: `User ${userId.slice(0, 8)}`,
        color: colors[colorIndex]
      };
    }
    return { name: 'Unknown', color: '#6c757d' };
  }

  function changeDay(direction: 'prev' | 'next') {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(isoLocal(dt));
  }

  function generateTimeSlots() {
    const slots: string[] = [];
    for (let hour = 6; hour < 21; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const suffix = hour >= 12 ? 'PM' : 'AM';
        slots.push(`${displayHour}:${minute.toString().padStart(2, '0')} ${suffix}`);
      }
    }
    return slots;
  }

  function buildScheduleEntries(schedule: string | null) {
    const slots = generateTimeSlots();
    if (!schedule) return [];
    const lines = schedule.split('\n');
    const entries: Array<{ time: string; activity: string }> = [];
    for (let i = 0; i < slots.length; i++) {
      const activity = (lines[i] || '').trim();
      if (activity) {
        entries.push({ time: slots[i], activity });
      }
    }
    return entries;
  }

  function groupTodos(todos: Task[]) {
    return {
      planned: todos.filter(t => (t.status || 'planned') === 'planned'),
      inProgress: todos.filter(t => t.status === 'in_progress'),
      done: todos.filter(t => t.status === 'done')
    };
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading daily view...</div>;
  if (error) return <div style={{ padding: '20px', color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '16px',
          backgroundColor: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: '8px'
        }}
      >
        <button
          onClick={() => changeDay('prev')}
          className="planner-button"
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem'
          }}
        >
          ← Previous
        </button>
        <h3
          style={{
            margin: 0,
            color: 'var(--foreground)',
            fontSize: '1.5rem',
            fontFamily: 'Georgia, serif',
            fontWeight: 'bold'
          }}
        >
          {headerLabel}
        </h3>
        <button
          onClick={() => changeDay('next')}
          className="planner-button"
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem'
          }}
        >
          Next →
        </button>
      </div>

      {memberDailyData.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--paper)',
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}
        >
          <h3>No daily plans yet</h3>
          <p>Circle members haven't added any plans for this day yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {memberDailyData.map(data => {
            const memberInfo = getMemberInfo(data.member.user_id);
            const scheduleEntries = buildScheduleEntries(data.schedule);
            const groupedTodos = groupTodos(data.todos);

            return (
              <div
                key={data.member.user_id}
                className="planner-card"
                style={{
                  backgroundColor: 'var(--paper)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 4px 8px var(--shadow)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '20px',
                    paddingBottom: '12px',
                    borderBottom: '2px solid var(--border)'
                  }}
                >
                  <div
                    style={{
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
                    }}
                  >
                    {data.member.user_id.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.4rem',
                        color: 'var(--foreground)',
                        fontFamily: 'Georgia, serif',
                        fontWeight: 'bold'
                      }}
                    >
                      {memberInfo.name}'s Day
                    </h3>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 0.8fr',
                    gap: '20px',
                    marginBottom: '20px'
                  }}
                >
                  <div
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '16px'
                    }}
                  >
                    <h4
                      style={{
                        marginTop: 0,
                        marginBottom: '12px',
                        color: 'var(--foreground)',
                        fontFamily: 'Georgia, serif',
                        fontSize: '1.1rem'
                      }}
                    >
                      Schedule
                    </h4>
                    {scheduleEntries.length > 0 ? (
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        {scheduleEntries.map((entry, idx) => (
                          <li
                            key={`${entry.time}-${idx}`}
                            style={{
                              display: 'flex',
                              gap: '12px',
                              marginBottom: '8px',
                              alignItems: 'baseline'
                            }}
                          >
                            <span
                              style={{
                                minWidth: '80px',
                                color: 'var(--foreground)',
                                fontWeight: 600,
                                fontSize: '0.9rem'
                              }}
                            >
                              {entry.time}
                            </span>
                            <span>{entry.activity}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        No schedule shared.
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      backgroundColor: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          marginTop: 0,
                          marginBottom: '10px',
                          color: 'var(--foreground)',
                          fontFamily: 'Georgia, serif',
                          fontSize: '1.1rem'
                        }}
                      >
                        Today's Priority
                      </h4>
                      {data.priority ? (
                        <div
                          style={{
                            backgroundColor: '#f3e5f5',
                            border: '1px solid #d1c4e9',
                            borderRadius: '8px',
                            padding: '12px',
                            color: 'var(--foreground)',
                            fontWeight: 'bold'
                          }}
                        >
                          {data.priority.title}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                          No priority set.
                        </div>
                      )}
                    </div>

                    <div>
                      <h4
                        style={{
                          marginTop: 0,
                          marginBottom: '10px',
                          color: 'var(--foreground)',
                          fontFamily: 'Georgia, serif',
                          fontSize: '1.1rem'
                        }}
                      >
                        Notes
                      </h4>
                      {data.notes ? (
                        <div
                          style={{
                            backgroundColor: '#fafafa',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '12px',
                            color: 'var(--text-muted)',
                            fontSize: '0.95rem',
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {data.notes}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                          No notes shared.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <h4
                    style={{
                      marginTop: 0,
                      marginBottom: '12px',
                      color: 'var(--foreground)',
                      fontFamily: 'Georgia, serif',
                      fontSize: '1.1rem'
                    }}
                  >
                    To-do List
                  </h4>
                  {data.todos.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                      No to-dos added.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      <TodoColumn title="Planned" items={groupedTodos.planned} />
                      <TodoColumn title="In Progress" items={groupedTodos.inProgress} />
                      <TodoColumn title="Done" items={groupedTodos.done} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TodoColumn({ title, items }: { title: string; items: Task[] }) {
  return (
    <div>
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: '8px',
          color: 'var(--foreground)',
          fontSize: '0.95rem'
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.length === 0 ? (
          <div
            style={{
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              fontSize: '0.85rem',
              backgroundColor: '#f8f9fa',
              border: '1px dashed var(--border)',
              borderRadius: '6px',
              padding: '10px'
            }}
          >
            None
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '10px',
                backgroundColor: '#f8f9fa',
                fontSize: '0.9rem'
              }}
            >
              <div style={{ fontWeight: 'bold', color: 'var(--foreground)' }}>{item.title}</div>
              {item.description && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                  {item.description}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


