'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useEffect, useMemo, useState } from 'react';

type RoutineType = 'morning' | 'evening';

type RoutineStep = {
  id: string;
  text: string;
  durationMinutes?: number | null;
  completedDates?: string[]; // ISO yyyy-mm-dd strings
};

type Routine = {
  id: string;
  user_id: string;
  circle_id: string | null;
  type: RoutineType;
  steps: RoutineStep[];
  created_at: string;
};

export default function PersonalRoutinesPage() {
  const supabase = createBrowserSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [routines, setRoutines] = useState<Record<RoutineType, Routine | null>>({
    morning: null,
    evening: null
  });
  const [editing, setEditing] = useState<Record<RoutineType, boolean>>({ morning: false, evening: false });
  const [draftSteps, setDraftSteps] = useState<Record<RoutineType, RoutineStep[]>>({ morning: [], evening: [] });
  const [addingStepText, setAddingStepText] = useState<Record<RoutineType, string>>({ morning: '', evening: '' });

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    loadRoutines();
  }, []);

  async function loadRoutines() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      if (typeof window !== 'undefined') window.location.href = '/login';
      return;
    }

    try {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .is('circle_id', null)
        .in('type', ['morning', 'evening']);

      if (error) throw error;

      const morning = (data || []).find(r => r.type === 'morning') as Routine | undefined;
      const evening = (data || []).find(r => r.type === 'evening') as Routine | undefined;

      setRoutines({
        morning: morning ?? null,
        evening: evening ?? null
      });
      setDraftSteps({
        morning: morning?.steps ?? [],
        evening: evening?.steps ?? []
      });
      setEditing({ morning: false, evening: false });
      setLoading(false);
    } catch (e: any) {
      console.error('Error loading routines:', e);
      alert('Error loading routines: ' + (e?.message || JSON.stringify(e)));
      setLoading(false);
    }
  }

  async function ensureRoutine(type: RoutineType): Promise<Routine> {
    const existing = routines[type];
    if (existing) return existing;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user');

    const { data, error } = await supabase
      .from('routines')
      .insert({
        user_id: user.id,
        circle_id: null,
        type,
        steps: []
      })
      .select('*')
      .single();

    if (error) throw error;
    const routine = data as Routine;
    setRoutines(prev => ({ ...prev, [type]: routine }));
    setDraftSteps(prev => ({ ...prev, [type]: [] }));
    return routine;
  }

  function addStep(type: RoutineType) {
    const text = addingStepText[type].trim();
    if (!text) return;
    const newStep: RoutineStep = {
      id: crypto.randomUUID(),
      text,
      durationMinutes: null,
      completedDates: []
    };
    setDraftSteps(prev => ({ ...prev, [type]: [...prev[type], newStep] }));
    setAddingStepText(prev => ({ ...prev, [type]: '' }));
  }

  function updateStepText(type: RoutineType, stepId: string, text: string) {
    setDraftSteps(prev => ({
      ...prev,
      [type]: prev[type].map(s => s.id === stepId ? { ...s, text } : s)
    }));
  }

  function updateStepDuration(type: RoutineType, stepId: string, duration: number | null) {
    setDraftSteps(prev => ({
      ...prev,
      [type]: prev[type].map(s => s.id === stepId ? { ...s, durationMinutes: duration } : s)
    }));
  }

  function deleteStep(type: RoutineType, stepId: string) {
    setDraftSteps(prev => ({
      ...prev,
      [type]: prev[type].filter(s => s.id !== stepId)
    }));
  }

  function moveStep(type: RoutineType, stepId: string, direction: 'up' | 'down') {
    setDraftSteps(prev => {
      const list = [...prev[type]];
      const index = list.findIndex(s => s.id === stepId);
      if (index === -1) return prev;
      const swapWith = direction === 'up' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= list.length) return prev;
      [list[index], list[swapWith]] = [list[swapWith], list[index]];
      return { ...prev, [type]: list };
    });
  }

  async function saveRoutine(type: RoutineType) {
    try {
      const routine = await ensureRoutine(type);
      const steps = draftSteps[type];
      const { error } = await supabase
        .from('routines')
        .update({ steps })
        .eq('id', routine.id);
      if (error) {
        console.error('Error saving routine:', error);
        alert('Error saving routine: ' + (error.message || 'Unknown error'));
        return;
      }
      setEditing(prev => ({ ...prev, [type]: false }));
      loadRoutines();
    } catch (e: any) {
      console.error('Error in saveRoutine:', e);
      alert('Error saving routine: ' + (e?.message || 'Unknown error'));
    }
  }

  async function toggleCompleteToday(type: RoutineType, stepId: string, completed: boolean) {
    // Update draft immediately for snappy UI, then persist
    setDraftSteps(prev => ({
      ...prev,
      [type]: prev[type].map(s => {
        if (s.id !== stepId) return s;
        const set = new Set(s.completedDates ?? []);
        if (completed) set.add(today); else set.delete(today);
        return { ...s, completedDates: Array.from(set) };
      })
    }));

    try {
      const routine = await ensureRoutine(type);
      const updated = draftSteps[type].map(s => {
        if (s.id !== stepId) return s;
        const set = new Set(s.completedDates ?? []);
        if (completed) set.add(today); else set.delete(today);
        return { ...s, completedDates: Array.from(set) };
      });

      const { error } = await supabase
        .from('routines')
        .update({ steps: updated })
        .eq('id', routine.id);
      if (error) {
        console.error('Error updating completion:', error);
        alert('Error updating completion: ' + (error.message || 'Unknown error'));
        // reload to sync in case of failure
        loadRoutines();
        return;
      }
      // sync local after successful save
      setDraftSteps(prev => ({ ...prev, [type]: updated }));
    } catch (e: any) {
      console.error('Error in toggleCompleteToday:', e);
      alert('Error updating completion: ' + (e?.message || 'Unknown error'));
      loadRoutines();
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading your routines...</div>;

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '2rem', margin: 0, color: '#000' }}>My Routines</h2>
        <p style={{ color: '#000', marginTop: '8px' }}>Manage your personal morning and evening routines.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {(['morning', 'evening'] as RoutineType[]).map((type) => {
          const routine = routines[type];
          const steps = draftSteps[type] ?? [];
          const isEditing = editing[type];
          const title = type === 'morning' ? '🌅 Morning Routine' : '🌙 Evening Routine';
          return (
            <div key={type} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', backgroundColor: '#f9f9f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#000' }}>{title}</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!isEditing ? (
                    <button
                      onClick={async () => {
                        try {
                          if (!routine) await ensureRoutine(type);
                          setEditing(prev => ({ ...prev, [type]: true }));
                        } catch (e: any) {
                          console.error('Error preparing routine for edit:', e);
                          alert('Error preparing routine: ' + (e?.message || JSON.stringify(e)));
                        }
                      }}
                      style={{ backgroundColor: '#007bff', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => saveRoutine(type)}
                        style={{ backgroundColor: '#28a745', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          // reset draft to persisted
                          setDraftSteps(prev => ({ ...prev, [type]: routine?.steps ?? [] }));
                          setEditing(prev => ({ ...prev, [type]: false }));
                        }}
                        style={{ backgroundColor: '#6c757d', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Steps list */}
              {steps.length === 0 ? (
                <div style={{ color: '#000', backgroundColor: '#fff', border: '1px dashed #ddd', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
                  No steps yet. {isEditing ? 'Add your first step below.' : 'Click Edit to add steps.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {steps.map((step, idx) => {
                    const doneToday = !!step.completedDates?.includes(today);
                    return (
                      <div key={step.id} style={{ backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            {!isEditing && (
                              <input
                                type="checkbox"
                                checked={doneToday}
                                onChange={(e) => toggleCompleteToday(type, step.id, e.target.checked)}
                                title={doneToday ? 'Completed today' : 'Mark done today'}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#007bff' }}
                              />
                            )}
                            {isEditing ? (
                              <input
                                type="text"
                                value={step.text}
                                onChange={(e) => updateStepText(type, step.id, e.target.value)}
                                style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}
                                placeholder="Describe the step"
                              />
                            ) : (
                              <div style={{ color: '#000', fontWeight: 'bold' }}>{step.text}</div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                value={step.durationMinutes ?? ''}
                                onChange={(e) => updateStepDuration(type, step.id, e.target.value === '' ? null : Number(e.target.value))}
                                placeholder="min"
                                style={{ width: '70px', padding: '6px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}
                              />
                            ) : (
                              step.durationMinutes ? (
                                <span style={{ color: '#666', fontSize: '0.9rem' }}>{step.durationMinutes} min</span>
                              ) : null
                            )}

                            {isEditing && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => moveStep(type, step.id, 'up')}
                                  style={{ backgroundColor: '#e9ecef', color: '#000', padding: '6px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  title="Move up"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => moveStep(type, step.id, 'down')}
                                  style={{ backgroundColor: '#e9ecef', color: '#000', padding: '6px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  title="Move down"
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() => deleteStep(type, step.id)}
                                  style={{ backgroundColor: '#dc3545', color: 'white', padding: '6px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add step */}
              {editing[type] && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <input
                    type="text"
                    value={addingStepText[type]}
                    onChange={(e) => setAddingStepText(prev => ({ ...prev, [type]: e.target.value }))}
                    placeholder="Add a step"
                    style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', color: '#000' }}
                  />
                  <button
                    onClick={() => addStep(type)}
                    disabled={!addingStepText[type].trim()}
                    style={{ backgroundColor: '#007bff', color: 'white', padding: '8px 12px', border: 'none', borderRadius: '4px', cursor: addingStepText[type].trim() ? 'pointer' : 'not-allowed' }}
                  >
                    + Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


