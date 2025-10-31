'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

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

export default function PersonalHabitsPage() {
  const supabase = createBrowserSupabaseClient();
  
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitForm, setHabitForm] = useState({ name: '' });

  useEffect(() => {
    loadHabits();
  }, [currentMonth]);

  async function loadHabits() {
    console.log('loadHabits called for month:', currentMonth);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('habits')
      .select(`
        *,
        habit_checks (*)
      `)
      .eq('user_id', user.id)
      .eq('month_year', currentMonth)
      .is('circle_id', null) // Personal habits only
      .order('created_at', { ascending: true });

    console.log('loadHabits result:', { data, error });

    if (error) {
      console.error('Error loading habits:', error);
      return;
    }

    console.log('Setting habits:', data);
    if (data && data.length > 0) {
      console.log('First habit checks:', data[0].habit_checks);
    }
    
    // Ensure habit_checks is always an array
    const habitsWithChecks = (data || []).map(habit => ({
      ...habit,
      checks: habit.habit_checks || []
    }));
    
    console.log('Processed habits with checks:', habitsWithChecks);
    setHabits(habitsWithChecks);
    setLoading(false);
  }

  async function createHabit() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('habits')
      .insert({
        user_id: user.id,
        circle_id: null, // Personal habit
        name: habitForm.name,
        month_year: currentMonth
      });

    if (error) {
      console.error('Error creating habit:', error);
      console.error('Error details:', error.message);
      alert('Error creating habit: ' + error.message);
      return;
    }

    setHabitForm({ name: '' });
    setShowHabitForm(false);
    loadHabits();
  }

  async function updateHabit(habitId: string) {
    const { error } = await supabase
      .from('habits')
      .update({ name: habitForm.name })
      .eq('id', habitId);

    if (error) {
      console.error('Error updating habit:', error);
      return;
    }

    setEditingHabit(null);
    setHabitForm({ name: '' });
    loadHabits();
  }

  async function deleteHabit(habitId: string) {
    if (!confirm('Are you sure you want to delete this habit?')) return;

    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId);

    if (error) {
      console.error('Error deleting habit:', error);
      return;
    }

    loadHabits();
  }

  async function toggleHabitCheck(habitId: string, date: string, completed: boolean) {
    console.log('toggleHabitCheck called:', { habitId, date, completed });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No user found');
      return;
    }

    if (completed) {
      console.log('Attempting to create habit check...');
      // First try to insert, if it fails due to duplicate key, then update
      const { error: insertError } = await supabase
        .from('habit_checks')
        .insert({
          habit_id: habitId,
          date,
          completed: true
        });

      console.log('Insert result:', { insertError });

      if (insertError) {
        // If insert failed due to duplicate key, try to update
        if (insertError.code === '23505') { // Unique constraint violation
          console.log('Duplicate key, attempting update...');
          const { error: updateError } = await supabase
            .from('habit_checks')
            .update({ completed: true })
            .eq('habit_id', habitId)
            .eq('date', date);

          console.log('Update result:', { updateError });
          if (updateError) {
            console.error('Error updating habit check:', updateError);
            return;
          }
        } else {
          console.error('Error creating habit check:', insertError);
          alert('Error creating habit check: ' + insertError.message);
          return;
        }
      } else {
        console.log('Habit check created successfully');
      }
    } else {
      console.log('Attempting to delete habit check...');
      // Delete check
      const { error } = await supabase
        .from('habit_checks')
        .delete()
        .eq('habit_id', habitId)
        .eq('date', date);

      console.log('Delete result:', { error });
      if (error) {
        console.error('Error deleting habit check:', error);
        return;
      }
    }

    console.log('Reloading habits...');
    loadHabits();
  }

  function startEditHabit(habit: Habit) {
    setEditingHabit(habit);
    setHabitForm({ name: habit.name });
    setShowHabitForm(true);
  }

  function getDaysInMonth() {
    const [year, month] = currentMonth.split('-').map(Number);
    // month is 1-based (1-12), but Date constructor expects 0-based (0-11)
    // To get the last day of the current month, we use month (1-based) as the month parameter
    // and 0 as the day, which gives us the last day of the previous month
    // But since we want the current month, we need to use month (not month-1)
    // Actually: new Date(year, month, 0) gives us the last day of month-1
    // So for month=10 (October), this gives us the last day of September
    // We want the last day of October, so we need month+1
    return new Date(year, month, 0).getDate();
  }

  function getDateString(day: number) {
    const [year, month] = currentMonth.split('-').map(Number);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function isChecked(habit: Habit, day: number) {
    const dateString = getDateString(day);
    const result = habit.checks?.some(check => check.date === dateString && check.completed) || false;
    console.log(`isChecked for habit ${habit.id}, day ${day} (${dateString}):`, result, 'checks:', habit.checks);
    return result;
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

  if (loading) return <div style={{ padding: '20px' }}>Loading your habits...</div>;

  const daysInMonth = getDaysInMonth();
  // Build month name using numeric Date constructor to avoid UTC parsing issues
  const [yearNum, monthNum] = currentMonth.split('-').map(Number);
  const monthMidDate = new Date(yearNum, monthNum - 1, 15);
  const monthName = monthMidDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '2rem', margin: 0, color: '#000' }}>My Habits</h2>
          <button
            onClick={() => setShowHabitForm(true)}
            disabled={habits.length >= 10}
            style={{
              backgroundColor: habits.length >= 10 ? '#6c757d' : '#007bff',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: habits.length >= 10 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            + New Habit {habits.length >= 10 ? '(Max 10)' : ''}
          </button>
        </div>

        {/* Month Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button
            onClick={() => changeMonth('prev')}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Previous
          </button>
          <h3 style={{ margin: 0, color: '#000', fontSize: '1.5rem' }}>{monthName}</h3>
          <button
            onClick={() => changeMonth('next')}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Habit Form Modal */}
      {showHabitForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            color: '#000',
            fontSize: '16px',
            fontFamily: 'inherit'
          }}>
            <h3 style={{ marginTop: 0, color: '#000', fontSize: '1.3rem', fontWeight: 'bold' }}>
              {editingHabit ? 'Edit Habit' : 'Add New Habit'}
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Habit Name *</label>
              <input
                type="text"
                value={habitForm.name}
                onChange={(e) => setHabitForm({ name: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                placeholder="e.g., Drink 8 glasses of water"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={editingHabit ? () => updateHabit(editingHabit.id) : createHabit}
                disabled={!habitForm.name}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: habitForm.name ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold'
                }}
              >
                {editingHabit ? 'Update Habit' : 'Add Habit'}
              </button>
              <button
                onClick={() => {
                  setShowHabitForm(false);
                  setEditingHabit(null);
                  setHabitForm({ name: '' });
                }}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Habits Grid */}
      {habits.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#666',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <h3>No habits yet</h3>
          <p>Create your first habit to start tracking!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {habits.map((habit) => (
            <div key={habit.id} style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#f9f9f9'
            }}>
              {/* Habit Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.3rem', color: '#000', fontWeight: 'bold' }}>
                    {habit.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem', color: '#666' }}>
                    <span>Streak: {getStreak(habit)} days</span>
                    <span>Completion: {getCompletionPercentage(habit)}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => startEditHabit(habit)}
                    style={{
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      padding: '5px 10px',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      padding: '5px 10px',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Habit Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${daysInMonth + 1}, 1fr)`,
                gap: '2px',
                fontSize: '0.8rem'
              }}>
                {/* Day headers */}
                <div style={{ fontWeight: 'bold', color: '#666', textAlign: 'center', padding: '5px' }}>
                  Day
                </div>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                  <div key={day} style={{ 
                    fontWeight: 'bold', 
                    color: '#666', 
                    textAlign: 'center', 
                    padding: '5px',
                    backgroundColor: 'white',
                    borderRadius: '2px'
                  }}>
                    {day}
                  </div>
                ))}

                {/* Habit checkboxes */}
                <div style={{ fontWeight: 'bold', color: '#000', textAlign: 'center', padding: '5px' }}>
                  ✓
                </div>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const isCompleted = isChecked(habit, day);
                  const dateString = getDateString(day);
                  const isToday = dateString === new Date().toISOString().split('T')[0];
                  
                  return (
                    <div key={day} style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={(e) => toggleHabitCheck(habit.id, dateString, e.target.checked)}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          accentColor: '#007bff'
                        }}
                      />
                      {isToday && (
                        <div style={{
                          width: '4px',
                          height: '4px',
                          backgroundColor: '#007bff',
                          borderRadius: '50%',
                          margin: '2px auto 0',
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Month Summary */}
      {habits.length > 0 && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px'
        }}>
          <h3 style={{ marginTop: 0, color: '#000' }}>Month Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            {habits.map((habit) => (
              <div key={habit.id} style={{
                padding: '10px',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ fontWeight: 'bold', color: '#000', marginBottom: '5px' }}>
                  {habit.name}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  {getCompletionPercentage(habit)}% complete • {getStreak(habit)} day streak
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
