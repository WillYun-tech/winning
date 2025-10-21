'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type CalendarEvent = {
  id: string;
  user_id: string;
  circle_id: string | null;
  title: string;
  date: string; // yyyy-mm-dd
  created_at: string;
};

export default function PersonalMonthPage() {
  const supabase = createBrowserSupabaseClient();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [newEvent, setNewEvent] = useState<{ title: string; date: string }>({ title: '', date: '' });
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState<{ title: string; date: string }>({ title: '', date: '' });

  // Month notes (DB-backed)
  const [goalsText, setGoalsText] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [savingGoals, setSavingGoals] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  
  // Monthly goals as tasks
  const [monthlyGoals, setMonthlyGoals] = useState<Array<{id: string, text: string, completed: boolean}>>([]);
  const [newGoalText, setNewGoalText] = useState('');

  // Temporary workaround toggle: set to false while debugging root cause
  const APPLY_MONTH_OFFSET = false;
  const MONTH_OFFSET = 1; // add 1 month

  function applyMonthOffset(yearMonth: string): string {
    if (!APPLY_MONTH_OFFSET) return yearMonth;
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + MONTH_OFFSET, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  const effectiveYearMonth = applyMonthOffset(currentMonth);
  const daysGrid = useMemo(() => buildMonthGrid(effectiveYearMonth), [effectiveYearMonth]);
  const inMonthDayCount = useMemo(() => daysGrid.filter(c => c.inMonth).length, [daysGrid]);
  const monthLabel = useMemo(() => {
    const [y, m] = effectiveYearMonth.split('-').map(Number);
    // Use the 15th to avoid edge cases around DST transitions at month boundaries
    const midMonth = new Date(y, m - 1, 15);
    return midMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [effectiveYearMonth]);

  // ---- Debug logging ----
  useEffect(() => {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('[CAL] now local:', now.toString());
    console.log('[CAL] now ISO:', now.toISOString());
    console.log('[CAL] timezone:', tz);
    console.log('[CAL] currentMonth (base):', currentMonth);
    console.log('[CAL] effectiveYearMonth (applied offset?):', effectiveYearMonth, 'offsetEnabled=', APPLY_MONTH_OFFSET);
    const [rangeStart, rangeEnd] = monthDateRange(effectiveYearMonth);
    console.log('[CAL] monthDateRange:', { rangeStart, rangeEnd });
    // Log a preview of grid
    console.log('[CAL] grid sample first 7 cells:', daysGrid.slice(0, 7));
    console.log('[CAL] inMonthDayCount:', inMonthDayCount);
    console.log('[CAL] monthLabel:', monthLabel);
  }, [currentMonth, effectiveYearMonth, inMonthDayCount, daysGrid, monthLabel]);

  useEffect(() => {
    loadEvents();
    loadMonthNotes();
  }, [currentMonth]);

  async function loadEvents() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      if (typeof window !== 'undefined') window.location.href = '/login';
      return;
    }

    // For now, load personal events table if present; fallback to tasks later
    const [startDate, endDate] = monthDateRange(effectiveYearMonth);
    const { data, error } = await supabase
      .from('tasks')
      .select('id, user_id, circle_id, title, date, created_at')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('type', 'event')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error loading events:', error);
      setLoading(false);
      return;
    }

    const mapped: CalendarEvent[] = (data || []).map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      circle_id: t.circle_id,
      title: t.title,
      date: t.date,
      created_at: t.created_at
    }));
    setEvents(mapped);
    setLoading(false);
  }

  async function loadMonthNotes() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load current month goals
    const { data: currentRows, error: err1 } = await supabase
      .from('month_notes')
      .select('goals')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('month_year', effectiveYearMonth);
    if (err1) {
      console.error('Error loading current month notes:', err1);
    }
    const goalsData = (currentRows && currentRows[0]?.goals) || '';
    setGoalsText(goalsData);
    
    // Parse goals text into task format
    const goalLines = goalsData.split('\n').filter((line: string) => line.trim());
    
    const parsedGoals = goalLines.map((line: string, index: number) => {
      const isCompleted = line.startsWith('✅') || line.startsWith('[x]') || line.startsWith('[X]');
      // Remove checkboxes and clean the text properly
      const text = line.replace(/^[✅☐\[\]xX\s]+/, '').trim();
      // Create stable ID based on text content
      const stableId = `goal-${text.replace(/\s+/g, '-').toLowerCase()}-${index}`;
      return {
        id: stableId,
        text: text || line.trim(),
        completed: isCompleted
      };
    });
    setMonthlyGoals(parsedGoals);

    // Load previous month review
    const prev = prevMonth(effectiveYearMonth);
    const { data: prevRows, error: err2 } = await supabase
      .from('month_notes')
      .select('review')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('month_year', prev);
    if (err2) {
      console.error('Error loading previous month review:', err2);
    }
    setReviewText((prevRows && prevRows[0]?.review) || '');
  }

  async function saveGoals() {
    await saveGoalsWithGoals(monthlyGoals);
  }

  async function saveGoalsWithGoals(goals: Array<{id: string, text: string, completed: boolean}>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingGoals(true);
    // Preserve existing review for this month if present (we don't edit it here)
    const { data: existing, error: err } = await supabase
      .from('month_notes')
      .select('review')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('month_year', effectiveYearMonth);
    if (err) console.error('Error reading existing month review:', err);
    const keepReview = existing && existing[0]?.review ? existing[0].review : null;

    // Convert monthly goals back to text format
    const goalsText = goals.map(goal => 
      goal.completed ? `✅ ${goal.text}` : `☐ ${goal.text}`
    ).join('\n');

    const { error } = await supabase
      .from('month_notes')
      .upsert({
        user_id: user.id,
        circle_id: null,
        month_year: effectiveYearMonth,
        goals: goalsText,
        review: keepReview
      }, { onConflict: 'user_id,month_year' });
    if (error) {
      console.error('Error saving goals:', error);
      alert('Error saving goals: ' + (error.message || 'Unknown error'));
    }
    setSavingGoals(false);
  }

  function addMonthlyGoal() {
    if (!newGoalText.trim()) return;
    const newGoal = {
      id: `goal-${Date.now()}`,
      text: newGoalText.trim(),
      completed: false
    };
    const updatedGoals = [...monthlyGoals, newGoal];
    setMonthlyGoals(updatedGoals);
    setNewGoalText('');
    saveGoalsWithGoals(updatedGoals);
  }

  async function toggleMonthlyGoal(goalId: string) {
    const goal = monthlyGoals.find(g => g.id === goalId);
    if (!goal) return;

    const newCompleted = !goal.completed;
    
    // Update the state and get the new goals array
    const updatedGoals = monthlyGoals.map(goal => 
      goal.id === goalId ? { ...goal, completed: newCompleted } : goal
    );
    
    setMonthlyGoals(updatedGoals);
    
    // Create win when goal is completed, delete when unchecked
    if (newCompleted) {
      await createWinForGoal(goal.text, 'monthly');
    } else {
      await deleteWinForGoal(goal.text, 'monthly');
    }
    
    await saveGoalsWithGoals(updatedGoals);
  }

  async function createWinForGoal(goalText: string, category: 'monthly' | 'weekly' | 'goal') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('wins')
      .insert({
        user_id: user.id,
        circle_id: null,
        title: goalText,
        description: `Completed ${category} goal`,
        goal_id: null,
        milestone_id: null
      });

    if (error) {
      console.error('Error creating win:', error);
      // Don't show alert for win creation errors to avoid interrupting user flow
    }
  }

  async function deleteWinForGoal(goalText: string, category: 'monthly' | 'weekly' | 'goal') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Delete win associated with this goal
    const { error } = await supabase
      .from('wins')
      .delete()
      .eq('user_id', user.id)
      .eq('title', goalText)
      .like('description', `%${category} goal%`);

    if (error) {
      console.error('Error deleting win for goal:', error);
      // Don't show alert for win deletion errors to avoid interrupting user flow
    }
  }

  function deleteMonthlyGoal(goalId: string) {
    const updatedGoals = monthlyGoals.filter(goal => goal.id !== goalId);
    setMonthlyGoals(updatedGoals);
    saveGoalsWithGoals(updatedGoals);
  }

  async function saveReview() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingReview(true);
    const prev = prevMonth(effectiveYearMonth);

    // Preserve existing goals for prev month if present
    const { data: existing, error: err } = await supabase
      .from('month_notes')
      .select('goals')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('month_year', prev);
    if (err) console.error('Error reading existing prev goals:', err);
    const keepGoals = existing && existing[0]?.goals ? existing[0].goals : null;

    const { error } = await supabase
      .from('month_notes')
      .upsert({
        user_id: user.id,
        circle_id: null,
        month_year: prev,
        goals: keepGoals,
        review: reviewText
      }, { onConflict: 'user_id,month_year' });
    if (error) {
      console.error('Error saving review:', error);
      alert('Error saving review: ' + (error.message || 'Unknown error'));
    }
    setSavingReview(false);
  }

  async function createEvent() {
    const title = newEvent.title.trim();
    const date = newEvent.date;
    if (!title || !date) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (typeof window !== 'undefined') window.location.href = '/login';
      return;
    }

    const payload: any = {
      user_id: user.id,
      circle_id: null,
      title,
      date,
      type: 'event'
    };

    const { error } = await supabase.from('tasks').insert(payload);
    if (error) {
      console.error('Error creating event:', error);
      alert('Error creating event: ' + (error.message || 'Unknown error'));
      return;
    }
    setNewEvent({ title: '', date: '' });
    loadEvents();
  }

  function openEdit(ev: CalendarEvent) {
    setEditingEvent(ev);
    setEventForm({ title: ev.title, date: ev.date });
  }

  async function updateEvent() {
    if (!editingEvent) return;
    const title = eventForm.title.trim();
    const date = eventForm.date;
    if (!title || !date) return;

    const { error } = await supabase
      .from('tasks')
      .update({ title, date })
      .eq('id', editingEvent.id);
    if (error) {
      console.error('Error updating event:', error);
      alert('Error updating event: ' + (error.message || 'Unknown error'));
      return;
    }
    setEditingEvent(null);
    loadEvents();
  }

  async function deleteEvent(ev: CalendarEvent) {
    if (!confirm('Delete this event?')) return;
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', ev.id);
    if (error) {
      console.error('Error deleting event:', error);
      alert('Error deleting event: ' + (error.message || 'Unknown error'));
      return;
    }
    if (editingEvent?.id === ev.id) setEditingEvent(null);
    loadEvents();
  }

  function changeMonth(direction: 'prev' | 'next') {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + (direction === 'next' ? 1 : -1), 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function eventsOn(dateISO: string) {
    return events.filter(e => e.date === dateISO);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <button onClick={() => changeMonth('prev')} style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← Previous</button>
        <h2 style={{ margin: 0, color: '#000' }}>{monthLabel}</h2>
        <button onClick={() => changeMonth('next')} style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Next →</button>
      </div>
      <div style={{ marginBottom: '20px', color: '#000' }}>{inMonthDayCount} days</div>

      {/* Quick add */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', backgroundColor: '#fff', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newEvent.title}
            onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Add quick event (title)"
            style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}
          />
          <input
            type="date"
            value={newEvent.date}
            onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
            style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}
          />
          <button
            onClick={createEvent}
            disabled={!newEvent.title || !newEvent.date}
            style={{ backgroundColor: '#007bff', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: (!newEvent.title || !newEvent.date) ? 'not-allowed' : 'pointer' }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dow => (
          <div key={dow} style={{ textAlign: 'center', fontWeight: 'bold', color: '#000' }}>{dow}</div>
        ))}
        {daysGrid.map((cell, idx) => (
          <div key={idx} style={{
            minHeight: '90px',
            backgroundColor: cell.inMonth ? '#fff' : '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            padding: '8px',
            opacity: cell.inMonth ? 1 : 0.5
          }}
          onClick={() => {
            if (cell.inMonth && cell.dateISO) setNewEvent(prev => ({ ...prev, date: cell.dateISO! }));
          }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#000' }}>{cell.inMonth ? cell.day : ''}</span>
              {cell.inMonth && cell.isToday && <span style={{ fontSize: '0.75rem', color: '#007bff' }}>Today</span>}
            </div>
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {cell.inMonth && cell.dateISO && (() => {
                const list = eventsOn(cell.dateISO);
                const first = list.slice(0, 3);
                const extra = list.length - first.length;
                return (
                  <>
                    {first.map(ev => (
                      <div key={ev.id} style={{ fontSize: '0.85rem', color: '#000', backgroundColor: '#f1f3f5', borderRadius: '4px', padding: '2px 4px', cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {extra > 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>+{extra} more</div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ))}
      </div>

      {/* Month Goals & Review */}
      <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ marginTop: 0, color: '#000' }}>This Month's Goals</h3>
          <p style={{ color: '#666', marginTop: 0 }}>Set and track your monthly goals.</p>
          
          {/* Add new goal */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="text"
              value={newGoalText}
              onChange={(e) => setNewGoalText(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') addMonthlyGoal(); }}
              placeholder="Add a monthly goal..."
              style={{ 
                flex: 1, 
                padding: '8px 12px', 
                border: '1px solid #ccc', 
                borderRadius: '4px', 
                color: '#000' 
              }}
            />
            <button
              onClick={addMonthlyGoal}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Add
            </button>
          </div>

          {/* Goals list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {monthlyGoals.length === 0 ? (
              <div style={{ 
                color: '#666', 
                textAlign: 'center', 
                padding: '20px',
                fontStyle: 'italic'
              }}>
                No goals set for this month yet.
              </div>
            ) : (
              monthlyGoals.map((goal) => (
                <div
                  key={goal.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    backgroundColor: goal.completed ? '#f8f9fa' : '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={goal.completed}
                    onChange={() => toggleMonthlyGoal(goal.id)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#28a745'
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      color: goal.completed ? '#666' : '#000',
                      textDecoration: goal.completed ? 'line-through' : 'none',
                      fontSize: '0.95rem'
                    }}
                  >
                    {goal.text}
                  </span>
                  <button
                    onClick={() => deleteMonthlyGoal(goal.id)}
                    style={{
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
          
          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>
            {savingGoals ? 'Saving…' : ` ${monthlyGoals.filter(g => g.completed).length}/${monthlyGoals.length} completed`}
          </div>
        </div>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ marginTop: 0, color: '#000' }}>Last Month Review</h3>
          <p style={{ color: '#666', marginTop: 0 }}>Reflect on achievements and lessons learned.</p>
          <textarea
            placeholder="e.g., Biggest wins, what I learned, what to improve"
            style={{ width: '100%', minHeight: '120px', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', color: '#000' }}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            onBlur={saveReview}
          />
          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>{savingReview ? 'Saving…' : ' '}</div>
        </div>
      </div>

      {/* Edit Event Modal */}
      {editingEvent && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', width: '90%', maxWidth: '480px', color: '#000' }}>
            <h3 style={{ marginTop: 0 }}>Edit Event</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Title</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Date</label>
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingEvent(null)} style={{ backgroundColor: '#6c757d', color: '#fff', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={updateEvent} style={{ backgroundColor: '#28a745', color: '#fff', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
                <button onClick={() => editingEvent && deleteEvent(editingEvent)} style={{ backgroundColor: '#dc3545', color: '#fff', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
    // Compute today's date using LOCAL timezone
    const now = new Date();
    const todayLocalISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
    // Always render 6 weeks (42 cells) starting from the first cell of the week containing the 1st
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

function prevMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}


