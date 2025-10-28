'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type CircleMember = {
  user_id: string;
  circle_id: string;
  joined_at: string;
  role: string;
};

type Habit = {
  id: string;
  name: string;
  month_year: string;
  created_at: string;
  checks: HabitCheck[];
};

type HabitCheck = {
  id: string;
  habit_id: string;
  date: string;
  completed: boolean;
  created_at: string;
};

type MemberHabits = {
  member: CircleMember;
  habits: Habit[];
};

export default function CircleHabitsView({ circleId }: { circleId: string }) {
  console.log('[CircleHabits] Component rendering with circleId:', circleId);
  const supabase = createBrowserSupabaseClient();
  const [memberHabits, setMemberHabits] = useState<MemberHabits[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Initialize to current month, but set it in useEffect to ensure client-side execution
  const [currentMonth, setCurrentMonth] = useState<string>('');
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

  // Initialize currentMonth on client side only
  useEffect(() => {
    if (!currentMonth) {
      const now = new Date();
      const formattedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      console.log('[CircleHabits] Initializing currentMonth:', {
        now: now.toString(),
        year: now.getFullYear(),
        monthZeroIndexed: now.getMonth(),
        monthOneIndexed: now.getMonth() + 1,
        formattedMonth
      });
      setCurrentMonth(formattedMonth);
    }
  }, [currentMonth]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    })();
    
    if (currentMonth) {
      loadCircleHabits();
    }
  }, [circleId, currentMonth]);

  // Helper function to get display name from user ID
  function getDisplayName(userId: string, isCurrentUser: boolean): string {
    if (isCurrentUser) return 'You';
    if (userProfiles[userId]) return userProfiles[userId];
    // Generate a simple name from user ID
    const shortId = userId.slice(0, 8);
    return `User ${shortId}`;
  }

  async function loadCircleHabits() {
    try {
      setLoading(true);
      setError(null);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('User not authenticated:', authError);
        setError('Please log in to view circle habits');
        return;
      }

      // Get circle members
      const { data: members, error: membersError } = await supabase
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

      if (!members || members.length === 0) {
        setMemberHabits([]);
        setLoading(false);
        return;
      }

      // Generate display names
      const profileMap: Record<string, string> = {};
      members.forEach((member) => {
        if (member.user_id === currentUserId) {
          profileMap[member.user_id] = 'You';
        } else {
          const shortId = member.user_id.slice(0, 8);
          profileMap[member.user_id] = `User ${shortId}`;
        }
      });
      
      setUserProfiles(profileMap);

      // Load habits for each member
      const memberHabitsData: MemberHabits[] = [];
      for (const member of members) {
        const { data: habits, error: habitsError } = await supabase
          .from('habits')
          .select(`
            *,
            habit_checks (*)
          `)
          .eq('user_id', member.user_id)
          .eq('month_year', currentMonth)
          .is('circle_id', null) // Personal habits only
          .order('created_at', { ascending: true });

        if (habitsError) {
          console.error(`Error loading habits for member ${member.user_id}:`, habitsError);
          continue;
        }

        // Ensure habit_checks is always an array
        const habitsWithChecks = (habits || []).map(habit => ({
          ...habit,
          checks: habit.habit_checks || []
        }));

        memberHabitsData.push({
          member,
          habits: habitsWithChecks
        });
      }
      setMemberHabits(memberHabitsData);
    } catch (err: any) {
      console.error('Unexpected error in loadCircleHabits:', err);
      setError(`An unexpected error occurred: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  function getDaysInMonth() {
    const [year, month] = currentMonth.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }

  function getDateString(day: number) {
    const [year, month] = currentMonth.split('-').map(Number);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function isChecked(habit: Habit, day: number) {
    const dateString = getDateString(day);
    return habit.checks?.some(check => check.date === dateString && check.completed) || false;
  }

  function getStreak(habit: Habit) {
    const today = new Date();
    const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let streak = 0;
    
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(currentDate);
      checkDate.setDate(checkDate.getDate() - i);
      const dateString = checkDate.toISOString().split('T')[0];
      
      const hasCheck = habit.checks?.some(check => check.date === dateString && check.completed) || false;
      if (hasCheck) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  function getCompletionPercentage(habit: Habit) {
    const daysInMonth = getDaysInMonth();
    const completedDays = habit.checks?.filter(check => check.completed).length || 0;
    return Math.round((completedDays / daysInMonth) * 100);
  }

  function changeMonth(direction: 'prev' | 'next') {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1);
    const newMonth = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newMonth);
  }

  // Log state on every render
  console.log('[CircleHabits] Render state:', { currentMonth, loading, error, memberHabitsCount: memberHabits.length });

  if (!currentMonth || loading) {
    console.log('[CircleHabits] Rendering loading state - currentMonth:', currentMonth, 'loading:', loading);
    return <div style={{ padding: '20px' }}>Loading circle habits...</div>;
  }
  if (error) {
    console.log('[CircleHabits] Rendering error state:', error);
    return <div style={{ padding: '20px', color: 'var(--danger)' }}>Error: {error}</div>;
  }

  const daysInMonth = getDaysInMonth();
  // Format month name - parse explicitly to avoid timezone issues
  const [year, month] = currentMonth.split('-').map(Number);
  // Double-check: ensure month is valid (1-12) and not NaN
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    console.error('[CircleHabits] Invalid month values:', { currentMonth, year, month });
  }
  const monthDate = new Date(year, month - 1, 15); // Use 15th to avoid DST edge cases
  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  // Force log to console every render
  console.log('[CircleHabits] ===== MONTH NAME CALCULATION =====');
  console.log('[CircleHabits] currentMonth string:', currentMonth);
  console.log('[CircleHabits] Parsed year:', year, 'month:', month);
  console.log('[CircleHabits] monthDate.toString():', monthDate.toString());
  console.log('[CircleHabits] monthDate.toISOString():', monthDate.toISOString());
  console.log('[CircleHabits] monthDate.getMonth():', monthDate.getMonth(), '(0-indexed, so 9 = October)');
  console.log('[CircleHabits] Final monthName:', monthName);
  console.log('[CircleHabits] ===================================');

  return (
    <div>
      {/* Month Navigation */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px',
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
          {monthName}
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

      {/* Member Habits */}
      {memberHabits.length === 0 || memberHabits.every(m => m.habits.length === 0) ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: 'var(--text-muted)', 
          fontStyle: 'italic',
          backgroundColor: 'var(--paper)',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}>
          <h3>No habits tracked yet</h3>
          <p>Circle members haven't set up any habits for this month yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {memberHabits.map((data) => {
            if (data.habits.length === 0) return null;
            
            return (
              <div key={data.member.user_id} style={{ marginBottom: '30px' }}>
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
                      {getDisplayName(data.member.user_id, data.member.user_id === currentUserId)}'s Habits
                    </h3>
                    <p style={{ 
                      margin: 0, 
                      color: 'var(--text-muted)', 
                      fontSize: '0.9rem' 
                    }}>
                      {data.habits.length} habit{data.habits.length !== 1 ? 's' : ''} tracked
                    </p>
                  </div>
                </div>

                {/* Habits Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {data.habits.map((habit) => (
                    <div key={habit.id} className="planner-card" style={{
                      backgroundColor: 'var(--paper)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: '0 4px 8px var(--shadow)'
                    }}>
                      {/* Habit Header */}
                      <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ 
                          margin: '0 0 8px 0', 
                          fontSize: '1.2rem', 
                          color: 'var(--foreground)', 
                          fontWeight: 'bold',
                          fontFamily: 'Georgia, serif'
                        }}>
                          {habit.name}
                        </h4>
                        <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                          <span>🔥 Streak: {getStreak(habit)} days</span>
                          <span>✅ Completion: {getCompletionPercentage(habit)}%</span>
                        </div>
                      </div>

                      {/* Habit Grid - Read-only */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${daysInMonth + 1}, 1fr)`,
                        gap: '2px',
                        fontSize: '0.75rem'
                      }}>
                        {/* Day headers */}
                        <div style={{ 
                          fontWeight: 'bold', 
                          color: 'var(--text-muted)', 
                          textAlign: 'center', 
                          padding: '5px',
                          backgroundColor: 'white',
                          borderRadius: '4px'
                        }}>
                          Day
                        </div>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                          <div key={day} style={{ 
                            fontWeight: 'bold', 
                            color: 'var(--text-muted)', 
                            textAlign: 'center', 
                            padding: '5px',
                            backgroundColor: 'white',
                            borderRadius: '4px'
                          }}>
                            {day}
                          </div>
                        ))}

                        {/* Habit checkboxes - Read-only */}
                        <div style={{ 
                          fontWeight: 'bold', 
                          color: 'var(--foreground)', 
                          textAlign: 'center', 
                          padding: '5px',
                          backgroundColor: 'white',
                          borderRadius: '4px'
                        }}>
                          ✓
                        </div>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                          const isCompleted = isChecked(habit, day);
                          const dateString = getDateString(day);
                          const isToday = dateString === new Date().toISOString().split('T')[0];
                          
                          return (
                            <div 
                              key={day} 
                              style={{ 
                                textAlign: 'center',
                                padding: '8px 4px',
                                backgroundColor: isCompleted ? '#e8f5e9' : 'white',
                                borderRadius: '4px',
                                border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                                position: 'relative'
                              }}
                            >
                              {isCompleted && (
                                <span style={{ 
                                  fontSize: '1rem',
                                  color: '#4caf50',
                                  fontWeight: 'bold'
                                }}>✓</span>
                              )}
                              {isToday && !isCompleted && (
                                <div style={{
                                  width: '6px',
                                  height: '6px',
                                  backgroundColor: 'var(--accent)',
                                  borderRadius: '50%',
                                  margin: '4px auto 0',
                                }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      {memberHabits.some(m => m.habits.length > 0) && (
        <div style={{
          marginTop: '40px',
          padding: '24px',
          backgroundColor: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 4px 8px var(--shadow)'
        }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: '20px',
            color: 'var(--foreground)', 
            fontFamily: 'Georgia, serif',
            fontWeight: 'bold'
          }}>
            Circle Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            {memberHabits.map((data) => {
              if (data.habits.length === 0) return null;
              
              const totalStreak = data.habits.reduce((sum, habit) => sum + getStreak(habit), 0);
              const avgCompletion = data.habits.length > 0
                ? Math.round(data.habits.reduce((sum, habit) => sum + getCompletionPercentage(habit), 0) / data.habits.length)
                : 0;
              
              return (
                <div key={data.member.user_id} style={{
                  padding: '15px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--foreground)', marginBottom: '8px' }}>
                    {getDisplayName(data.member.user_id, data.member.user_id === currentUserId)}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {data.habits.length} habit{data.habits.length !== 1 ? 's' : ''} • {avgCompletion}% avg completion
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    🔥 {Math.round(totalStreak / data.habits.length)} day avg streak
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

