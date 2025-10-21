'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type Task = {
  id: string;
  user_id: string;
  circle_id: string | null;
  title: string;
  description: string | null;
  type: string | null; // 'task' | 'event' | 'priority'
  date: string | null; // yyyy-mm-dd
  time: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  status: 'planned' | 'in_progress' | 'done' | null;
  linked_goal_id: string | null;
  linked_milestone_id: string | null;
  created_at: string;
};

export default function PersonalDayPage() {
  const supabase = createBrowserSupabaseClient();

  const [selectedDate, setSelectedDate] = useState(() => isoLocal(new Date()));
  const [loading, setLoading] = useState(true);

  // Priority (one per day via tasks type='priority')
  const [dailyPriority, setDailyPriority] = useState('');
  const [savingPriority, setSavingPriority] = useState(false);

  // Schedule/Notes (day_notes table)
  const [scheduleText, setScheduleText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  
  // Time blocks state (30-min slots from 6am to 9pm)
  const [timeBlocks, setTimeBlocks] = useState<string[]>([]);
  const [selectedRange, setSelectedRange] = useState<{start: number, end: number} | null>(null);
  const [rangeActivity, setRangeActivity] = useState('');

  // To-dos (tasks type='task' on this date)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');

  const headerLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [selectedDate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadPriority(), loadDayNotes(), loadTodos()]);
      setLoading(false);
    })();
  }, [selectedDate]);

  // Generate 30-minute time blocks from 6am to 9pm (30 blocks total)
  function generateTimeBlocks() {
    const blocks = [];
    for (let hour = 6; hour < 21; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayTime = hour > 12 ? `${hour - 12}:${minute.toString().padStart(2, '0')} PM` : 
                           hour === 12 ? `12:${minute.toString().padStart(2, '0')} PM` :
                           hour === 0 ? `12:${minute.toString().padStart(2, '0')} AM` :
                           `${hour}:${minute.toString().padStart(2, '0')} AM`;
        blocks.push({
          time: displayTime,
          activity: timeBlocks[blocks.length] || ''
        });
      }
    }
    return blocks;
  }

  function updateTimeBlock(index: number, activity: string) {
    const newBlocks = [...timeBlocks];
    newBlocks[index] = activity;
    setTimeBlocks(newBlocks);
    // Update scheduleText to save to database
    setScheduleText(newBlocks.join('\n'));
  }

  function handleBlockClick(index: number) {
    if (!selectedRange) {
      // Start new selection
      setSelectedRange({ start: index, end: index });
    } else if (selectedRange.start === index) {
      // Clicking same block - clear selection
      setSelectedRange(null);
    } else {
      // Extend selection
      setSelectedRange({
        start: Math.min(selectedRange.start, index),
        end: Math.max(selectedRange.end, index)
      });
    }
  }

  async function applyRangeActivity() {
    if (!selectedRange || !rangeActivity.trim()) return;
    
    const newBlocks = [...timeBlocks];
    for (let i = selectedRange.start; i <= selectedRange.end; i++) {
      newBlocks[i] = rangeActivity;
    }
    const newScheduleText = newBlocks.join('\n');
    
    setTimeBlocks(newBlocks);
    setScheduleText(newScheduleText);
    setSelectedRange(null);
    setRangeActivity('');
    
    // Save directly with the new schedule text
    await saveScheduleDirectly(newScheduleText);
  }

  function clearRange() {
    setSelectedRange(null);
    setRangeActivity('');
  }

  function changeDay(direction: 'prev' | 'next') {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(isoLocal(dt));
  }

  async function loadPriority() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('type', 'priority')
      .eq('date', selectedDate)
      .limit(1);
    if (error) {
      console.error('Error loading priority:', error);
      return;
    }
    setDailyPriority((data && data[0]?.title) || '');
  }

  async function savePriority() {
    const title = dailyPriority.trim();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingPriority(true);
    // Try find existing
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('type', 'priority')
      .eq('date', selectedDate)
      .limit(1);
    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('tasks')
        .update({ title })
        .eq('id', existing[0].id);
      if (error) {
        console.error('Error updating priority:', error);
        alert('Error updating priority: ' + (error.message || 'Unknown error'));
      }
    } else if (title) {
      const { error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          circle_id: null,
          title,
          type: 'priority',
          date: selectedDate,
          priority: 'high',
          status: 'planned'
        } as any);
      if (error) {
        console.error('Error creating priority:', error);
        alert('Error creating priority: ' + (error.message || 'Unknown error'));
      }
    }
    setSavingPriority(false);
  }

  async function loadDayNotes() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('day_notes')
      .select('schedule, notes')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('date', selectedDate)
      .limit(1);
    if (error) {
      // If table doesn't exist, keep UI functional without crashing
      console.warn('Day notes load error (ensure table exists):', error);
      setScheduleText('');
      setNotesText('');
      return;
    }
    const scheduleData = (data && data[0]?.schedule) || '';
    setScheduleText(scheduleData);
    setNotesText((data && data[0]?.notes) || '');
    
    // Parse schedule text into time blocks (split by newlines)
    const blocks = scheduleData.split('\n').slice(0, 30); // Limit to 30 blocks
    setTimeBlocks(blocks);
  }

  async function saveScheduleDirectly(scheduleText: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingNotes(true);
    
    // Read existing to preserve notes
    const { data: existing } = await supabase
      .from('day_notes')
      .select('notes')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('date', selectedDate)
      .limit(1);
    
    const currentNotes = (existing && existing[0]?.notes) || '';
    
    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('day_notes')
        .update({ schedule: scheduleText, notes: currentNotes })
        .eq('user_id', user.id)
        .is('circle_id', null)
        .eq('date', selectedDate);
      if (error) {
        console.error('Error saving schedule:', error);
        alert('Error saving schedule: ' + (error.message || 'Unknown error'));
      }
    } else {
      const { error } = await supabase
        .from('day_notes')
        .insert({
          user_id: user.id,
          circle_id: null,
          date: selectedDate,
          schedule: scheduleText,
          notes: currentNotes
        });
      if (error) {
        console.error('Error creating day notes:', error);
        alert('Error creating notes: ' + (error.message || 'Unknown error'));
      }
    }
    setSavingNotes(false);
  }

  async function saveDayNotes(which: 'schedule' | 'notes') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingNotes(true);
    // Read existing to preserve the other field
    const { data: existing } = await supabase
      .from('day_notes')
      .select('schedule, notes')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('date', selectedDate)
      .limit(1);
    const currentSchedule = which === 'schedule' ? scheduleText : (existing && existing[0]?.schedule) || '';
    const currentNotes = which === 'notes' ? notesText : (existing && existing[0]?.notes) || '';
    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('day_notes')
        .update({ schedule: currentSchedule, notes: currentNotes })
        .eq('user_id', user.id)
        .is('circle_id', null)
        .eq('date', selectedDate);
      if (error) {
        console.error('Error saving day notes:', error);
        alert('Error saving notes: ' + (error.message || 'Unknown error'));
      }
    } else {
      const { error } = await supabase
        .from('day_notes')
        .insert({
          user_id: user.id,
          circle_id: null,
          date: selectedDate,
          schedule: currentSchedule,
          notes: currentNotes
        });
      if (error) {
        console.error('Error creating day notes:', error);
        alert('Error creating notes: ' + (error.message || 'Unknown error'));
      }
    }
    setSavingNotes(false);
  }

  async function loadTodos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('type', 'task')
      .eq('date', selectedDate)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading todos:', error);
      return;
    }
    setTasks(data || []);
  }

  async function addTodo() {
    const title = newTodoTitle.trim();
    if (!title) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        circle_id: null,
        title,
        type: 'task',
        date: selectedDate,
        priority: 'medium',
        status: 'planned'
      } as any);
    if (error) {
      console.error('Error creating todo:', error);
      alert('Error creating todo: ' + (error.message || 'Unknown error'));
      return;
    }
    setNewTodoTitle('');
    loadTodos();
  }

  async function toggleTodoDone(t: Task) {
    const next = (t.status === 'done') ? 'planned' : 'done';
    const { error } = await supabase
      .from('tasks')
      .update({ status: next })
      .eq('id', t.id);
    if (error) {
      console.error('Error updating todo:', error);
      alert('Error updating todo: ' + (error.message || 'Unknown error'));
      return;
    }
    // Daily tasks don't create wins - only weekly, monthly, and big goals do
    loadTodos();
  }

  async function deleteTodo(t: Task) {
    const { error } = await supabase.from('tasks').delete().eq('id', t.id);
    if (error) {
      console.error('Error deleting todo:', error);
      alert('Error deleting todo: ' + (error.message || 'Unknown error'));
      return;
    }
    loadTodos();
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading day…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => changeDay('prev')} style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← Previous</button>
        <h2 style={{ margin: 0, color: '#000' }}>{headerLabel}</h2>
        <button onClick={() => changeDay('next')} style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Next →</button>
      </div>

      {/* Priority */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
        <h3 style={{ marginTop: 0, color: '#000' }}>Today's Priority (one thing)</h3>
        <input
          type="text"
          value={dailyPriority}
          onChange={(e) => setDailyPriority(e.target.value)}
          onBlur={savePriority}
          placeholder="Focus of the day"
          style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', color: '#000' }}
        />
        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>{savingPriority ? 'Saving…' : ' '}</div>
      </div>

      {/* Schedule & Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ marginTop: 0, color: '#000' }}>Daily Schedule (30-min blocks)</h3>
          
          {/* Range Selection Controls */}
          {selectedRange && (
            <div style={{ 
              backgroundColor: '#e3f2fd', 
              border: '1px solid #2196f3', 
              borderRadius: '4px', 
              padding: '12px', 
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#1976d2', fontWeight: 'bold' }}>
                Selected: {generateTimeBlocks()[selectedRange.start].time} - {generateTimeBlocks()[selectedRange.end].time}
              </div>
              <input
                type="text"
                value={rangeActivity}
                onChange={(e) => setRangeActivity(e.target.value)}
                placeholder="Enter activity for selected range"
                style={{ 
                  flex: 1, 
                  padding: '6px 8px', 
                  border: '1px solid #2196f3', 
                  borderRadius: '4px', 
                  fontSize: '0.9rem',
                  color: '#000'
                }}
              />
              <button
                onClick={applyRangeActivity}
                style={{
                  backgroundColor: '#2196f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Apply
              </button>
              <button
                onClick={clearRange}
                style={{
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Clear
              </button>
            </div>
          )}

          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
            {generateTimeBlocks().map((block, index) => {
              const isSelected = selectedRange && index >= selectedRange.start && index <= selectedRange.end;
              return (
                <div 
                  key={index} 
                  onClick={() => handleBlockClick(index)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '8px 12px', 
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: isSelected ? '#e3f2fd' : (index % 2 === 0 ? '#fafafa' : '#fff'),
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <div style={{ 
                    width: '80px', 
                    fontSize: '0.9rem', 
                    fontWeight: 'bold', 
                    color: isSelected ? '#1976d2' : '#666',
                    flexShrink: 0
                  }}>
                    {block.time}
                  </div>
                  <input
                    type="text"
                    value={block.activity}
                    onChange={(e) => updateTimeBlock(index, e.target.value)}
                    onBlur={() => saveDayNotes('schedule')}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="What are you doing?"
                    style={{ 
                      flex: 1, 
                      padding: '6px 8px', 
                      border: isSelected ? '1px solid #2196f3' : '1px solid #ddd', 
                      borderRadius: '4px', 
                      fontSize: '0.9rem',
                      color: '#000',
                      backgroundColor: isSelected ? '#fff' : 'transparent'
                    }}
                  />
                </div>
              );
            })}
          </div>
          
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666' }}>
            💡 Tip: Click blocks to select a range, then enter an activity to apply it to all selected blocks
          </div>
        </div>
        <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ marginTop: 0, color: '#000' }}>Notes</h3>
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            onBlur={() => saveDayNotes('notes')}
            placeholder="Notes, reflections, ideas"
            style={{ width: '100%', minHeight: '140px', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', color: '#000' }}
          />
          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>{savingNotes ? 'Saving…' : ' '}</div>
        </div>
      </div>

      {/* To-do list */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
        <h3 style={{ marginTop: 0, color: '#000' }}>To‑do List</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            placeholder="Add a to‑do"
            style={{ flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '6px', color: '#000' }}
          />
          <button onClick={addTodo} disabled={!newTodoTitle.trim()} style={{ backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px 14px', cursor: newTodoTitle.trim() ? 'pointer' : 'not-allowed' }}>Add</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tasks.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '10px', backgroundColor: '#f8f9fa' }}>
              <input type="checkbox" checked={t.status === 'done'} onChange={() => toggleTodoDone(t)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#007bff' }} />
              <div style={{ color: '#000', flex: 1, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</div>
              <button onClick={() => deleteTodo(t)} style={{ backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 8px', cursor: 'pointer' }}>Delete</button>
            </div>
          ))}
          {tasks.length === 0 && (
            <div style={{ color: '#666' }}>No to‑dos for this day yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


