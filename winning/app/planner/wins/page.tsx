'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type Win = {
  id: string;
  user_id: string;
  circle_id: string | null;
  title: string;
  description: string | null;
  task_id: string | null;
  goal_id: string | null;
  milestone_id: string | null;
  created_at: string;
  // For display
  user_email?: string;
  goal_title?: string;
  milestone_title?: string;
  category?: string;
};

type Goal = { id: string; title: string };
type Milestone = { id: string; title: string; goal_id: string };

export default function PersonalWinsPage() {
  const supabase = createBrowserSupabaseClient();
  
  const [wins, setWins] = useState<Win[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('me');
  const [showNewWinModal, setShowNewWinModal] = useState(false);
  const [newWin, setNewWin] = useState({
    title: '',
    description: '',
    goal_id: null as string | null,
    milestone_id: null as string | null
  });

  useEffect(() => {
    loadWins();
    loadGoals();
  }, [selectedUser]);

  async function loadWins() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from('wins')
      .select(`
        *,
        goals (title),
        milestones (title)
      `)
      .order('created_at', { ascending: false });

    if (selectedUser !== 'me') {
      query = query.eq('user_id', selectedUser);
    } else {
      query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error loading wins:', error);
      // If table doesn't exist, show empty state instead of crashing
      if (error.message?.includes('relation "wins" does not exist')) {
        console.warn('Wins table does not exist yet. Please run the SQL to create it.');
        setWins([]);
        setLoading(false);
        return;
      }
      alert('Error loading wins: ' + (error.message || 'Unknown error'));
      return;
    }

    // Transform the data to include related info and category
    const transformedWins = (data || []).map((win: any) => {
      let category = 'General';
      if (win.description?.includes('monthly goal')) category = 'Monthly Goals';
      else if (win.description?.includes('weekly task')) category = 'Weekly Goals';
      else if (win.description?.includes('milestone')) category = 'Goals & Milestones';
      else if (win.task_id) category = 'Tasks';

      return {
        ...win,
        goal_title: win.goals?.title || null,
        milestone_title: win.milestones?.title || null,
        category
      };
    });

    setWins(transformedWins);
    setLoading(false);
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

  async function createWin() {
    if (!newWin.title.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('wins')
      .insert({
        user_id: user.id,
        circle_id: null,
        title: newWin.title,
        description: newWin.description || null,
        goal_id: newWin.goal_id,
        milestone_id: newWin.milestone_id
      });

    if (error) {
      console.error('Error creating win:', error);
      alert('Error creating win: ' + (error.message || 'Unknown error'));
      return;
    }

    setNewWin({ title: '', description: '', goal_id: null, milestone_id: null });
    setShowNewWinModal(false);
    loadWins();
  }

  async function deleteWin(winId: string) {
    if (!confirm('Delete this win?')) return;

    const { error } = await supabase
      .from('wins')
      .delete()
      .eq('id', winId);

    if (error) {
      console.error('Error deleting win:', error);
      alert('Error deleting win: ' + (error.message || 'Unknown error'));
      return;
    }

    loadWins();
  }

  function openNewWinModal() {
    setNewWin({ title: '', description: '', goal_id: null, milestone_id: null });
    setMilestones([]);
    setShowNewWinModal(true);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading wins...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#000' }}>Wins & Achievements</h2>
        <button
          onClick={openNewWinModal}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          + Add Win
        </button>
      </div>

      {/* User Filter */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#000' }}>
          View wins for:
        </label>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
            color: '#000',
            minWidth: '200px'
          }}
        >
          <option value="me">My Wins</option>
          <option value="all">All Circle Members</option>
        </select>
      </div>

      {/* Wins List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {wins.length === 0 ? (
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '40px',
            textAlign: 'center',
            color: '#666'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏆</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#000' }}>No wins yet</h3>
            <p style={{ margin: 0 }}>
              {selectedUser === 'me' 
                ? "Start completing tasks and achieving goals to build your wins collection!"
                : "No wins from circle members yet."
              }
            </p>
          </div>
        ) : (
          (() => {
            // Group wins by category
            const groupedWins = wins.reduce((acc, win) => {
              const category = win.category || 'General';
              if (!acc[category]) acc[category] = [];
              acc[category].push(win);
              return acc;
            }, {} as Record<string, Win[]>);

            return Object.entries(groupedWins).map(([category, categoryWins]) => (
              <div key={category}>
                <h3 style={{ 
                  margin: '0 0 12px 0', 
                  color: '#000', 
                  fontSize: '1.2rem',
                  borderBottom: '2px solid #e0e0e0',
                  paddingBottom: '8px'
                }}>
                  {category} ({categoryWins.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {categoryWins.map((win) => (
                    <div
                      key={win.id}
                      style={{
                        backgroundColor: '#fff',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: '16px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>🏆</span>
                            <h4 style={{ margin: 0, color: '#000', fontSize: '1.1rem' }}>{win.title}</h4>
                          </div>
                          
                          {win.description && (
                            <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.95rem' }}>
                              {win.description}
                            </p>
                          )}

                          <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>
                              {formatDate(win.created_at)}
                            </span>
                            {win.goal_title && (
                              <span style={{ fontSize: '0.85rem', color: '#007bff', fontWeight: 'bold' }}>
                                Goal: {win.goal_title}
                              </span>
                            )}
                            {win.milestone_title && (
                              <span style={{ fontSize: '0.85rem', color: '#28a745', fontWeight: 'bold' }}>
                                Milestone: {win.milestone_title}
                              </span>
                            )}
                          </div>
                        </div>

                        {selectedUser === 'me' && (
                          <button
                            onClick={() => deleteWin(win.id)}
                            style={{
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '6px 10px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()
        )}
      </div>

      {/* New Win Modal */}
      {showNewWinModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            color: '#000'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#000' }}>Add New Win</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#000' }}>
                  Win Title *
                </label>
                <input
                  type="text"
                  value={newWin.title}
                  onChange={(e) => setNewWin(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="What did you accomplish?"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    color: '#000'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#000' }}>
                  Description
                </label>
                <textarea
                  value={newWin.description}
                  onChange={(e) => setNewWin(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tell us more about this achievement..."
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    color: '#000'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#000' }}>
                  Related Goal
                </label>
                <select
                  value={newWin.goal_id || ''}
                  onChange={(e) => {
                    const goalId = e.target.value || null;
                    setNewWin(prev => ({ ...prev, goal_id: goalId, milestone_id: null }));
                    if (goalId) loadMilestonesForGoal(goalId);
                    else setMilestones([]);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    color: '#000'
                  }}
                >
                  <option value="">(none)</option>
                  {goals.map(goal => (
                    <option key={goal.id} value={goal.id}>{goal.title}</option>
                  ))}
                </select>
              </div>

              {milestones.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#000' }}>
                    Related Milestone
                  </label>
                  <select
                    value={newWin.milestone_id || ''}
                    onChange={(e) => setNewWin(prev => ({ ...prev, milestone_id: e.target.value || null }))}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      color: '#000'
                    }}
                  >
                    <option value="">(none)</option>
                    {milestones.map(milestone => (
                      <option key={milestone.id} value={milestone.id}>{milestone.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={() => setShowNewWinModal(false)}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createWin}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  cursor: 'pointer'
                }}
              >
                Add Win
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
