'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type CircleMember = {
  user_id: string;
  circle_id: string;
  joined_at: string;
  role: string;
};

type CalendarEvent = {
  id: string;
  user_id: string;
  circle_id: string | null;
  title: string;
  date: string; // yyyy-mm-dd
  created_at: string;
};

type MemberEvent = CalendarEvent & {
  memberName: string;
  memberColor: string;
};

export default function CircleCalendarView({ circleId }: { circleId: string }) {
  const supabase = createBrowserSupabaseClient();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<MemberEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Helper to get display name and color for a member
  function getMemberInfo(userId: string): { name: string; color: string } {
    if (userId === currentUserId) {
      return { name: 'You', color: '#6b5b95' }; // Use accent color for current user
    }
    const member = members.find(m => m.user_id === userId);
    if (member) {
      // Generate a consistent color based on user_id
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

        // Helper to get member info from loaded data
        const getMemberInfoFromData = (userId: string, membersList: CircleMember[], currentUser: string | null) => {
          if (userId === currentUser) {
            return { name: 'You', color: '#6b5b95' };
          }
          const member = membersList.find(m => m.user_id === userId);
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
        };

        // Load events for all members
        if (memberRows && memberRows.length > 0) {
          const [startDate, endDate] = monthDateRange(currentMonth);
          const memberIds = memberRows.map(m => m.user_id);

          const { data: events, error: eventsError } = await supabase
            .from('tasks')
            .select('id, user_id, circle_id, title, date, created_at')
            .in('user_id', memberIds)
            .is('circle_id', null)
            .eq('type', 'event')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

          if (eventsError) {
            console.error('Error loading events:', eventsError);
            setError(`Failed to load events: ${eventsError.message}`);
            setAllEvents([]);
          } else {
            // Map events with member info using the loaded data directly
            const eventsWithMembers: MemberEvent[] = (events || []).map(event => {
              const memberInfo = getMemberInfoFromData(event.user_id, memberRows, user?.id || null);
              return {
                ...event,
                memberName: memberInfo.name,
                memberColor: memberInfo.color
              };
            });
            setAllEvents(eventsWithMembers);
          }
        }
      } catch (e: any) {
        console.error('Unexpected error loading calendar:', e);
        setError(e?.message || 'Unexpected error');
      } finally {
        setLoading(false);
      }
    })();
  }, [circleId, currentMonth, supabase]);

  const daysGrid = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);
  const inMonthDayCount = useMemo(() => daysGrid.filter(c => c.inMonth).length, [daysGrid]);
  const monthLabel = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const midMonth = new Date(y, m - 1, 15);
    return midMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentMonth]);

  function changeMonth(direction: 'prev' | 'next') {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + (direction === 'next' ? 1 : -1), 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function eventsOn(dateISO: string): MemberEvent[] {
    return allEvents.filter(e => e.date === dateISO);
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading calendar...</div>;
  if (error) return <div style={{ padding: '20px', color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div>
      {/* Month Navigation */}
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
          onClick={() => changeMonth('prev')}
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
          {monthLabel}
        </h3>
        <button
          onClick={() => changeMonth('next')}
          className="planner-button"
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem'
          }}
        >
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '8px',
        marginBottom: '20px'
      }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dow => (
          <div 
            key={dow} 
            style={{ 
              textAlign: 'center', 
              fontWeight: 'bold', 
              color: 'var(--foreground)',
              padding: '8px'
            }}
          >
            {dow}
          </div>
        ))}
        {daysGrid.map((cell, idx) => {
          const dayEvents = cell.inMonth && cell.dateISO ? eventsOn(cell.dateISO) : [];
          return (
            <div 
              key={idx} 
              style={{
                minHeight: '100px',
                backgroundColor: cell.inMonth ? 'var(--paper)' : '#f8f9fa',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px',
                opacity: cell.inMonth ? 1 : 0.5
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '4px'
              }}>
                <span style={{ 
                  fontWeight: 'bold', 
                  color: cell.inMonth ? 'var(--foreground)' : 'var(--text-muted)',
                  fontSize: '0.9rem'
                }}>
                  {cell.inMonth ? cell.day : ''}
                </span>
                {cell.inMonth && cell.isToday && (
                  <span style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--accent)',
                    fontWeight: 'bold'
                  }}>
                    Today
                  </span>
                )}
              </div>
              <div style={{ 
                marginTop: '6px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '3px'
              }}>
                {dayEvents.slice(0, 3).map(event => (
                  <div 
                    key={event.id} 
                    style={{ 
                      fontSize: '0.75rem', 
                      color: '#fff',
                      backgroundColor: event.memberColor,
                      borderRadius: '3px', 
                      padding: '3px 6px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'default',
                      title: `${event.memberName}: ${event.title}`
                    }}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--text-muted)',
                    fontStyle: 'italic'
                  }}>
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {members.length > 0 && (
        <div style={{
          backgroundColor: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '20px'
        }}>
          <h4 style={{ 
            marginTop: 0, 
            marginBottom: '12px',
            color: 'var(--foreground)',
            fontFamily: 'Georgia, serif',
            fontSize: '1.1rem'
          }}>
            Members
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {members.map(member => {
              const info = getMemberInfo(member.user_id);
              return (
                <div 
                  key={member.user_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <div 
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      backgroundColor: info.color
                    }}
                  />
                  <span style={{ 
                    fontSize: '0.9rem', 
                    color: 'var(--foreground)'
                  }}>
                    {info.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions (copied from month page)
function monthDateRange(yearMonth: string): [string, string] {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const startISO = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const endISO = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return [startISO, endISO];
}

function buildMonthGrid(yearMonth: string) {
  const [y, m] = yearMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const leading = first.getDay(); // 0=Sun

  const cells: { day: number; inMonth: boolean; dateISO: string; isToday?: boolean }[] = [];
  const now = new Date();
  const todayLocalISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (let i = 0; i < 42; i++) {
    const d = new Date(y, m - 1, 1 - leading + i);
    const dateISO = isoDateLocal(d);
    const isInMonth = d.getMonth() === (m - 1);
    cells.push({
      day: d.getDate(),
      inMonth: isInMonth,
      dateISO,
      isToday: isInMonth ? dateISO === todayLocalISO : false
    });
  }

  return cells;
}

function isoDateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

