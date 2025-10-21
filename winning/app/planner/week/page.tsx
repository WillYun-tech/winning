'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type ReviewRow = {
  id: string;
  user_id: string;
  circle_id: string | null;
  week_start: string; // yyyy-mm-dd, Sunday (or chosen start)
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
  type: string | null; // 'task' | 'event' | 'week'
  date: string | null; // yyyy-mm-dd
  time: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  status: 'planned' | 'in_progress' | 'done' | 'open' | null;
  linked_goal_id: string | null;
  linked_milestone_id: string | null;
  created_at: string;
};

type Goal = { id: string; title: string };
type Milestone = { id: string; title: string; goal_id: string };

export default function PersonalWeekPage() {
  const supabase = createBrowserSupabaseClient();

  // Week navigation state (current shown week start)
  const [weekStart, setWeekStart] = useState(() => getWeekStartLocal(new Date()));

  // Current and previous week ISO
  const currentWeekISO = useMemo(() => weekStart, [weekStart]);
  const prevWeekISO = useMemo(() => shiftWeek(currentWeekISO, -1), [currentWeekISO]);
  const nextWeekISO = useMemo(() => shiftWeek(currentWeekISO, 1), [currentWeekISO]);

  // Review data states
  const [lastWeek, setLastWeek] = useState<Partial<ReviewRow>>({});
  const [thisWeek, setThisWeek] = useState<Partial<ReviewRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ last: boolean; current: boolean }>({ last: false, current: false });

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<{ title: string; date: string; priority: 'low' | 'medium' | 'high'; status: 'planned' | 'in_progress' | 'done'; linked_goal_id: string | null; linked_milestone_id: string | null; notes: string }>(
    { title: '', date: currentWeekISO, priority: 'medium', status: 'planned', linked_goal_id: null, linked_milestone_id: null, notes: '' }
  );

  const headerLabel = useMemo(() => {
    const d = new Date(currentWeekISO + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, [currentWeekISO]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        loadWeek(prevWeekISO, 'last'),
        loadWeek(currentWeekISO, 'current'),
        loadGoals(),
        loadTasksForWeek(currentWeekISO)
      ]);
      setLoading(false);
    })();
  }, [currentWeekISO, prevWeekISO]);

  async function loadWeek(weekISO: string, which: 'last' | 'current') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('week_start', weekISO)
      .limit(1);
    if (error) {
      console.error('Error loading review:', error);
      return;
    }
    const row = (data && data[0]) as any | undefined;
    const payload: Partial<ReviewRow> = row ? {
      achievements: (row.achievements ?? '') as string,
      lessons: (row.lessons ?? '') as string,
      reflections: (row.reflections ?? '') as string,
      next_focus: (row.next_focus ?? '') as string,
      // If stored as text[], join into lines for the textarea; if text, use as is
      top_outcomes: Array.isArray(row.top_outcomes)
        ? (row.top_outcomes as string[]).join('\n')
        : (row.top_outcomes ?? '')
    } : { achievements: '', lessons: '', reflections: '', next_focus: '', top_outcomes: '' };
    if (which === 'last') setLastWeek(payload); else setThisWeek(payload);
  }

  function weekEndFromStart(weekISO: string): string {
    const [y, m, d] = weekISO.split('-').map(Number);
    const end = new Date(y, m - 1, d);
    end.setDate(end.getDate() + 6);
    return isoLocal(end);
  }

  async function loadGoals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('goals')
      .select('id, title')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading goals:', error);
      return;
    }
    setGoals(data || []);
  }

  async function loadMilestonesForGoal(goalId: string) {
    const { data, error } = await supabase
      .from('milestones')
      .select('id, title, goal_id')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error loading milestones:', error);
      return;
    }
    setMilestones(data || []);
  }

  async function loadTasksForWeek(weekISO: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const start = weekISO;
    const end = weekEndFromStart(weekISO);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .is('circle_id', null)
      .eq('type', 'week')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });
    if (error) {
      console.error('Error loading tasks:', error);
      return;
    }
    setTasks(data || []);
  }

  function openNewTask() {
    setEditingTask(null);
    setTaskForm({ title: '', date: currentWeekISO, priority: 'medium', status: 'planned', linked_goal_id: null, linked_milestone_id: null, notes: '' });
    setMilestones([]);
    setShowTaskModal(true);
  }

  function openEditTask(t: Task) {
    setEditingTask(t);
    setTaskForm({
      title: t.title,
      date: t.date || currentWeekISO,
      priority: (t.priority as any) || 'medium',
      status: ((t.status as any) === 'open' ? 'planned' : ((t.status as any) || 'planned')) as 'planned' | 'in_progress' | 'done',
      linked_goal_id: t.linked_goal_id,
      linked_milestone_id: t.linked_milestone_id,
      notes: t.description || ''
    });
    if (t.linked_goal_id) loadMilestonesForGoal(t.linked_goal_id);
    setShowTaskModal(true);
  }

  async function saveTask() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      user_id: user.id,
      circle_id: null,
      title: taskForm.title,
      description: taskForm.notes || null,
      type: 'week',
      date: taskForm.date,
      time: null,
      priority: taskForm.priority,
      linked_goal_id: taskForm.linked_goal_id,
      linked_milestone_id: taskForm.linked_milestone_id
    };
    if (editingTask) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
      if (error) {
        console.error('Error updating task:', error);
        alert('Error updating task: ' + (error.message || 'Unknown error'));
        return;
      }
    } else {
      // Rely on DB default for status to avoid check-constraint mismatch
      const { error } = await supabase.from('tasks').insert(payload);
      if (error) {
        console.error('Error creating task:', error);
        alert('Error creating task: ' + (error.message || 'Unknown error'));
        return;
      }
    }
    setShowTaskModal(false);
    loadTasksForWeek(currentWeekISO);
  }

  async function updateTaskStatus(t: Task, status: 'planned' | 'in_progress' | 'done') {
    const { error } = await supabase.from('tasks').update({ status }).eq('id', t.id);
    if (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + (error.message || 'Unknown error'));
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Create win when marking done, delete when moving away from done
    if (status === 'done') {
      await supabase.from('wins').insert({
        user_id: user.id,
        circle_id: null,
        title: t.title,
        description: `Completed weekly task${t.description ? ': ' + t.description : ''}`,
        task_id: t.id,
        goal_id: t.linked_goal_id
      });
    } else if (t.status === 'done') {
      // Task was previously done, now moving away from done - delete the win
      await supabase.from('wins').delete()
        .eq('user_id', user.id)
        .eq('task_id', t.id);
    }
    
    loadTasksForWeek(currentWeekISO);
  }

  async function deleteTask(t: Task) {
    if (!confirm('Delete this task?')) return;
    const { error } = await supabase.from('tasks').delete().eq('id', t.id);
    if (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task: ' + (error.message || 'Unknown error'));
      return;
    }
    loadTasksForWeek(currentWeekISO);
  }

  async function saveLastWeek() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(s => ({ ...s, last: true }));
    // First try saving assuming top_outcomes is text
    let { error } = await supabase
      .from('reviews')
      .upsert({
        user_id: user.id,
        circle_id: null,
        week_start: prevWeekISO,
        achievements: lastWeek.achievements || '',
        lessons: lastWeek.lessons || '',
        reflections: lastWeek.reflections || '',
        next_focus: lastWeek.next_focus || '',
        top_outcomes: lastWeek.top_outcomes || ''
      }, { onConflict: 'user_id,week_start' });
    if (error && (error.message || '').toLowerCase().includes('malformed array')) {
      // Retry saving as text[] by splitting lines
      const outcomesArray = (lastWeek.top_outcomes || '').split(/\r?\n/).filter(Boolean);
      const retry = await supabase
        .from('reviews')
        .upsert({
          user_id: user.id,
          circle_id: null,
          week_start: prevWeekISO,
          achievements: lastWeek.achievements || '',
          lessons: lastWeek.lessons || '',
          reflections: lastWeek.reflections || '',
          next_focus: lastWeek.next_focus || '',
          top_outcomes: outcomesArray
        }, { onConflict: 'user_id,week_start' });
      error = retry.error as any;
    }
    if (error) {
      console.error('Error saving last week:', error);
      alert('Error saving last week: ' + (error.message || 'Unknown error'));
    }
    setSaving(s => ({ ...s, last: false }));
  }

  async function saveThisWeek() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(s => ({ ...s, current: true }));
    // First try saving assuming top_outcomes is text
    let { error } = await supabase
      .from('reviews')
      .upsert({
        user_id: user.id,
        circle_id: null,
        week_start: currentWeekISO,
        achievements: thisWeek.achievements || '',
        lessons: thisWeek.lessons || '',
        reflections: thisWeek.reflections || '',
        next_focus: thisWeek.next_focus || '',
        top_outcomes: thisWeek.top_outcomes || ''
      }, { onConflict: 'user_id,week_start' });
    if (error && (error.message || '').toLowerCase().includes('malformed array')) {
      // Retry saving as text[] by splitting lines
      const outcomesArray = (thisWeek.top_outcomes || '').split(/\r?\n/).filter(Boolean);
      const retry = await supabase
        .from('reviews')
        .upsert({
          user_id: user.id,
          circle_id: null,
          week_start: currentWeekISO,
          achievements: thisWeek.achievements || '',
          lessons: thisWeek.lessons || '',
          reflections: thisWeek.reflections || '',
          next_focus: thisWeek.next_focus || '',
          top_outcomes: outcomesArray
        }, { onConflict: 'user_id,week_start' });
      error = retry.error as any;
    }
    if (error) {
      console.error('Error saving this week:', error);
      alert('Error saving this week: ' + (error.message || 'Unknown error'));
    }
    setSaving(s => ({ ...s, current: false }));
  }

  function changeWeek(direction: 'prev' | 'next') {
    setWeekStart(prev => shiftWeek(prev, direction === 'next' ? 1 : -1));
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading week…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => changeWeek('prev')} style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>← Previous</button>
        <h2 style={{ margin: 0, color: '#000' }}>Week of {headerLabel}</h2>
        <button onClick={() => changeWeek('next')} style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Next →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Last Week Review */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ marginTop: 0, color: '#000' }}>Last Week Review</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Field label="Achievements / Wins" value={lastWeek.achievements || ''} onChange={(v) => setLastWeek(s => ({ ...s, achievements: v }))} onBlur={saveLastWeek} />
            <Field label="Lessons / Improvements" value={lastWeek.lessons || ''} onChange={(v) => setLastWeek(s => ({ ...s, lessons: v }))} onBlur={saveLastWeek} />
            <Field label="Reflections" value={lastWeek.reflections || ''} onChange={(v) => setLastWeek(s => ({ ...s, reflections: v }))} onBlur={saveLastWeek} />
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>{saving.last ? 'Saving…' : ' '}</div>
        </div>

        {/* Upcoming Week Plan */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ marginTop: 0, color: '#000' }}>Plan This Week</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Field label="Focus Areas" value={thisWeek.next_focus || ''} onChange={(v) => setThisWeek(s => ({ ...s, next_focus: v }))} onBlur={saveThisWeek} />
            <Field label="Top 3 Outcomes" value={thisWeek.top_outcomes || ''} onChange={(v) => setThisWeek(s => ({ ...s, top_outcomes: v }))} onBlur={saveThisWeek} />
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>{saving.current ? 'Saving…' : ' '}</div>
        </div>
      </div>

      {/* This Week's Tasks */}
      <div style={{ marginTop: '20px', backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, color: '#000' }}>This Week's Tasks</h3>
          <button onClick={openNewTask} style={{ backgroundColor: '#007bff', color: '#fff', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ New Task</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {(['planned', 'in_progress', 'done'] as const).map(col => (
            <div key={col}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#000' }}>
                {col === 'planned' ? 'Planned' : col === 'in_progress' ? 'In Progress' : 'Done'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tasks.filter(t => (t.status || 'planned') === col).map(t => (
                  <div key={t.id} style={{ border: '1px solid #e0e0e0', borderRadius: '6px', padding: '8px', backgroundColor: '#f8f9fa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#000', fontWeight: 'bold' }}>{t.title}</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {col !== 'planned' && (
                          <button onClick={() => updateTaskStatus(t, 'planned')} title="Move to Planned" aria-label="Move to Planned" style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}>← Planned</button>
                        )}
                        {col !== 'in_progress' && (
                          <button onClick={() => updateTaskStatus(t, 'in_progress')} title="Start (move to In Progress)" aria-label="Start task" style={{ backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}>▶ Start</button>
                        )}
                        {col !== 'done' && (
                          <button onClick={() => updateTaskStatus(t, 'done')} title="Mark Done" style={{ backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer' }}>Done</button>
                        )}
                        <button onClick={() => openEditTask(t)} style={{ backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteTask(t)} style={{ backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer' }}>Del</button>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                      {(t.date || '')}
                      {t.priority ? ` • ${t.priority}` : ''}
                    </div>
                    {(t.linked_goal_id || t.linked_milestone_id) && (
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>
                        {goalTitle(t.linked_goal_id, goals)}{milestoneTitle(t.linked_milestone_id, milestones)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', width: '90%', maxWidth: '520px', color: '#000' }}>
            <h3 style={{ marginTop: 0 }}>{editingTask ? 'Edit Task' : 'New Task'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Title</label>
                <input type="text" value={taskForm.title} onChange={(e) => setTaskForm(f => ({ ...f, title: e.target.value }))} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Date</label>
                <input type="date" value={taskForm.date} onChange={(e) => setTaskForm(f => ({ ...f, date: e.target.value }))} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Priority</label>
                <select value={taskForm.priority} onChange={(e) => setTaskForm(f => ({ ...f, priority: e.target.value as any }))} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Status</label>
                <select value={taskForm.status} onChange={(e) => setTaskForm(f => ({ ...f, status: e.target.value as any }))} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}>
                  <option value="open">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Goal</label>
                <select value={taskForm.linked_goal_id || ''} onChange={(e) => { const v = e.target.value || null; setTaskForm(f => ({ ...f, linked_goal_id: v, linked_milestone_id: null })); if (v) loadMilestonesForGoal(v); else setMilestones([]); }} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}>
                  <option value="">(none)</option>
                  {goals.map(g => (<option key={g.id} value={g.id}>{g.title}</option>))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Milestone</label>
                <select value={taskForm.linked_milestone_id || ''} onChange={(e) => setTaskForm(f => ({ ...f, linked_milestone_id: e.target.value || null }))} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}>
                  <option value="">(none)</option>
                  {milestones.map(m => (<option key={m.id} value={m.id}>{m.title}</option>))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>Notes</label>
                <textarea value={taskForm.notes} onChange={(e) => setTaskForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', minHeight: '100px', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', color: '#000' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setShowTaskModal(false)} style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveTask} style={{ backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 12px', cursor: 'pointer' }}>{editingTask ? 'Save' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, onBlur }: { label: string; value: string; onChange: (v: string) => void; onBlur: () => void; }) {
  return (
    <div>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#000' }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={label}
        style={{ width: '100%', minHeight: '100px', padding: '10px', border: '1px solid #ccc', borderRadius: '6px', color: '#000' }}
      />
    </div>
  );
}

function getWeekStartLocal(d: Date): string {
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay(); // 0=Sun, 1=Mon, ...
  // Shift so week starts on Monday: offset = (day + 6) % 7
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

function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function goalTitle(goalId: string | null, goals: { id: string; title: string }[]) {
  if (!goalId) return '';
  const g = goals.find(x => x.id === goalId);
  return g ? `Goal: ${g.title}` : '';
}

function milestoneTitle(milestoneId: string | null, milestones: { id: string; title: string }[]) {
  if (!milestoneId) return '';
  const m = milestones.find(x => x.id === milestoneId);
  return m ? ` • Milestone: ${m.title}` : '';
}


