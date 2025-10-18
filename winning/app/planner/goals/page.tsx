'use client';

import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

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

export default function PersonalGoalsPage() {
  const supabase = createBrowserSupabaseClient();
  
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showMilestoneForm, setShowMilestoneForm] = useState<string | null>(null);

  // Form states
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    horizon: 'long-term' as 'long-term' | 'medium-term' | 'short-term',
    deadline: '',
    why: '',
    action_plan: '',
    strategy_notes: ''
  });

  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    due_week: ''
  });

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('goals')
      .select(`
        *,
        milestones (*)
      `)
      .eq('user_id', user.id)
      .is('circle_id', null) // Only personal goals
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading goals:', error);
      return;
    }

    setGoals(data || []);
    setLoading(false);
  }

  async function createGoal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        circle_id: null, // Personal goal
        title: goalForm.title,
        description: goalForm.description,
        horizon: goalForm.horizon,
        deadline: goalForm.deadline || null,
        why: goalForm.why || null,
        action_plan: goalForm.action_plan || null,
        strategy_notes: goalForm.strategy_notes || null
      });

    if (error) {
      console.error('Error creating goal:', error);
      return;
    }

    setGoalForm({
      title: '',
      description: '',
      horizon: 'long-term',
      deadline: '',
      why: '',
      action_plan: '',
      strategy_notes: ''
    });
    setShowGoalForm(false);
    loadGoals();
  }

  async function updateGoal(goalId: string) {
    const { error } = await supabase
      .from('goals')
      .update({
        title: goalForm.title,
        description: goalForm.description,
        horizon: goalForm.horizon,
        deadline: goalForm.deadline || null,
        why: goalForm.why || null,
        action_plan: goalForm.action_plan || null,
        strategy_notes: goalForm.strategy_notes || null
      })
      .eq('id', goalId);

    if (error) {
      console.error('Error updating goal:', error);
      return;
    }

    setEditingGoal(null);
    setGoalForm({
      title: '',
      description: '',
      horizon: 'long-term',
      deadline: '',
      why: '',
      action_plan: '',
      strategy_notes: ''
    });
    loadGoals();
  }

  async function deleteGoal(goalId: string) {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', goalId);

    if (error) {
      console.error('Error deleting goal:', error);
      return;
    }

    loadGoals();
  }

  async function createMilestone(goalId: string) {
    const { error } = await supabase
      .from('milestones')
      .insert({
        goal_id: goalId,
        title: milestoneForm.title,
        description: milestoneForm.description || null,
        due_week: milestoneForm.due_week || null
      });

    if (error) {
      console.error('Error creating milestone:', error);
      console.error('Error details:', error.message);
      alert('Error creating milestone: ' + error.message);
      return;
    }

    setMilestoneForm({
      title: '',
      description: '',
      due_week: ''
    });
    setShowMilestoneForm(null);
    loadGoals();
  }

  async function toggleMilestone(milestoneId: string, completed: boolean) {
    const { error } = await supabase
      .from('milestones')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null
      })
      .eq('id', milestoneId);

    if (error) {
      console.error('Error updating milestone:', error);
      return;
    }

    loadGoals();
  }

  function startEditGoal(goal: Goal) {
    setEditingGoal(goal);
    setGoalForm({
      title: goal.title,
      description: goal.description,
      horizon: goal.horizon,
      deadline: goal.deadline || '',
      why: goal.why || '',
      action_plan: goal.action_plan || '',
      strategy_notes: goal.strategy_notes || ''
    });
    setShowGoalForm(true);
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading your goals...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '2rem', margin: 0, color: '#000' }}>My Goals</h2>
          <button
            onClick={() => setShowGoalForm(true)}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            + New Goal
          </button>
        </div>
      </div>

      {/* Goal Form Modal */}
      {showGoalForm && (
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
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            color: '#000',
            fontSize: '16px',
            fontFamily: 'inherit'
          }}>
            <h2 style={{ marginTop: 0, color: '#000', fontSize: '1.5rem', fontWeight: 'bold' }}>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</h2>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Title *</label>
              <input
                type="text"
                value={goalForm.title}
                onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                placeholder="What do you want to achieve?"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Description</label>
              <textarea
                value={goalForm.description}
                onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', height: '80px' }}
                placeholder="More details about your goal..."
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Horizon *</label>
              <select
                value={goalForm.horizon}
                onChange={(e) => setGoalForm({ ...goalForm, horizon: e.target.value as any })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <option value="long-term">Long-term (6+ months)</option>
                <option value="medium-term">Medium-term (1-6 months)</option>
                <option value="short-term">Short-term (1-4 weeks)</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Deadline</label>
              <input
                type="date"
                value={goalForm.deadline}
                onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Why is this important?</label>
              <textarea
                value={goalForm.why}
                onChange={(e) => setGoalForm({ ...goalForm, why: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', height: '80px' }}
                placeholder="What's your motivation for this goal?"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Action Plan</label>
              <textarea
                value={goalForm.action_plan}
                onChange={(e) => setGoalForm({ ...goalForm, action_plan: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', height: '80px' }}
                placeholder="What steps will you take to achieve this goal?"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Strategy Notes</label>
              <textarea
                value={goalForm.strategy_notes}
                onChange={(e) => setGoalForm({ ...goalForm, strategy_notes: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', height: '80px' }}
                placeholder="Additional thoughts, strategies, or notes..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={editingGoal ? () => updateGoal(editingGoal.id) : createGoal}
                disabled={!goalForm.title}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: goalForm.title ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold'
                }}
              >
                {editingGoal ? 'Update Goal' : 'Create Goal'}
              </button>
              <button
                onClick={() => {
                  setShowGoalForm(false);
                  setEditingGoal(null);
                  setGoalForm({
                    title: '',
                    description: '',
                    horizon: 'long-term',
                    deadline: '',
                    why: '',
                    action_plan: '',
                    strategy_notes: ''
                  });
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

      {/* Goals List */}
      <div style={{ display: 'grid', gap: '20px' }}>
        {goals.map((goal) => (
          <div key={goal.id} style={{
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '20px',
            backgroundColor: '#f9f9f9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: '#000', fontWeight: 'bold' }}>{goal.title}</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <span style={{
                    backgroundColor: goal.horizon === 'long-term' ? '#dc3545' : goal.horizon === 'medium-term' ? '#ffc107' : '#28a745',
                    color: goal.horizon === 'medium-term' ? 'black' : 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold'
                  }}>
                    {goal.horizon.replace('-', ' ').toUpperCase()}
                  </span>
                  {goal.deadline && (
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>
                      Due: {new Date(goal.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={() => startEditGoal(goal)}
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
                  onClick={() => deleteGoal(goal.id)}
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
                <button
                  onClick={() => setShowMilestoneForm(goal.id)}
                  style={{
                    backgroundColor: '#28a745',
                    color: 'white',
                    padding: '5px 10px',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  + Add Milestone
                </button>
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
                        onChange={(e) => toggleMilestone(milestone.id, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', textDecoration: milestone.completed ? 'line-through' : 'none', color: '#000' }}>
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

        {goals.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
          }}>
            <h3>No goals yet</h3>
            <p>Create your first goal to get started!</p>
          </div>
        )}
      </div>

      {/* Milestone Form Modal */}
      {showMilestoneForm && (
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
            <h3 style={{ marginTop: 0, color: '#000', fontSize: '1.3rem', fontWeight: 'bold' }}>Add Milestone</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Title *</label>
              <input
                type="text"
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                placeholder="Milestone title"
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Description</label>
              <textarea
                value={milestoneForm.description}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', height: '60px' }}
                placeholder="Milestone description"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#000' }}>Due Week</label>
              <input
                type="date"
                value={milestoneForm.due_week}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, due_week: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => createMilestone(showMilestoneForm)}
                disabled={!milestoneForm.title}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: milestoneForm.title ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold'
                }}
              >
                Add Milestone
              </button>
              <button
                onClick={() => {
                  setShowMilestoneForm(null);
                  setMilestoneForm({ title: '', description: '', due_week: '' });
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
    </div>
  );
}
