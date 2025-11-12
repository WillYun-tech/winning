'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type CircleMember = {
  user_id: string;
  circle_id: string;
  joined_at: string;
  role: string;
};

type RawWin = {
  id: string;
  user_id: string;
  circle_id: string | null;
  title: string;
  description: string | null;
  task_id: string | null;
  goal_id: string | null;
  milestone_id: string | null;
  created_at: string;
  goals?: {
    title: string | null;
    horizon: 'long-term' | 'medium-term' | 'short-term' | null;
  } | null;
  milestones?: {
    title: string | null;
    goal_id: string | null;
  } | null;
};

type DisplayWin = RawWin & {
  category: 'Milestone' | 'Goal' | 'Task' | 'General';
  goal_title?: string | null;
  milestone_title?: string | null;
};

type OwnerFilter = 'all' | 'mine' | 'others';
type CategoryFilter = 'all' | 'Milestone' | 'Goal' | 'Task' | 'General';

export default function CircleWinsView({ circleId }: { circleId: string }) {
  const supabase = createBrowserSupabaseClient();
  const [members, setMembers] = useState<CircleMember[]>([]);
  const [wins, setWins] = useState<DisplayWin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  useEffect(() => {
    (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setError('Please log in to view circle wins');
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);
      await loadCircleWins(user.id);
    })();
  }, [circleId, supabase]);

  async function loadCircleWins(viewerId: string) {
    try {
      setLoading(true);
      setError(null);

      const { data: memberRows, error: membersError } = await supabase
        .from('circle_members')
        .select('user_id, circle_id, joined_at, role')
        .eq('circle_id', circleId);

      if (membersError) {
        setError(`Failed to load circle members: ${membersError.message || 'Unknown error'}`);
        return;
      }

      const circleMembers = memberRows || [];
      setMembers(circleMembers);

      if (circleMembers.length === 0) {
        setWins([]);
        return;
      }

      const memberIds = circleMembers.map(m => m.user_id);

      const [profilesResult, winsResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', memberIds),
        supabase
          .from('wins')
          .select(`
            id,
            user_id,
            circle_id,
            title,
            description,
            task_id,
            goal_id,
            milestone_id,
            created_at,
            goals (title, horizon),
            milestones (title, goal_id)
          `)
          .in('user_id', memberIds)
          .is('circle_id', null)
          .order('created_at', { ascending: false })
      ]);

      const profileMap: Record<string, string> = {};

      if (profilesResult.data) {
        profilesResult.data.forEach(profile => {
          if (profile.user_id === viewerId) {
            profileMap[profile.user_id] = 'You';
          } else if (profile.display_name && profile.display_name.trim().length > 0) {
            profileMap[profile.user_id] = profile.display_name.trim();
          }
        });
      }

      circleMembers.forEach(member => {
        if (!profileMap[member.user_id]) {
          if (member.user_id === viewerId) {
            profileMap[member.user_id] = 'You';
          } else {
            const shortId = member.user_id.slice(0, 8);
            profileMap[member.user_id] = `Member ${shortId}`;
          }
        }
      });

      setUserProfiles(profileMap);

      if (winsResult.error) {
        setError(`Failed to load wins: ${winsResult.error.message}`);
        setWins([]);
        return;
      }

      const transformedWins: DisplayWin[] = (winsResult.data || []).map((win: RawWin) => {
        const category = determineCategory(win);
        return {
          ...win,
          category,
          goal_title: win.goals?.title || null,
          milestone_title: win.milestones?.title || null
        };
      });

      setWins(transformedWins);
    } catch (err: any) {
      setError(`Unexpected error: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  const filteredWins = useMemo(() => {
    return wins.filter(win => {
      if (ownerFilter === 'mine' && win.user_id !== currentUserId) return false;
      if (ownerFilter === 'others' && win.user_id === currentUserId) return false;
      if (categoryFilter !== 'all' && win.category !== categoryFilter) return false;
      return true;
    });
  }, [wins, ownerFilter, categoryFilter, currentUserId]);

  const totals = useMemo(() => {
    const result = { total: wins.length, Milestone: 0, Goal: 0, Task: 0, General: 0 } as Record<string, number>;
    wins.forEach(win => {
      result[win.category] += 1;
    });
    return result;
  }, [wins]);

  if (loading) return <div style={{ padding: '20px' }}>Loading wins...</div>;
  if (error) return <div style={{ padding: '20px', color: 'var(--danger)' }}>Error: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div
        style={{
          backgroundColor: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '1.4rem',
              color: 'var(--foreground)',
              fontFamily: 'Georgia, serif',
              fontWeight: 'bold'
            }}
          >
            Wins Overview
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['all', 'mine', 'others'] as OwnerFilter[]).map(filter => (
              <button
                key={filter}
                onClick={() => setOwnerFilter(filter)}
                className="planner-button"
                style={{
                  padding: '8px 14px',
                  fontSize: '0.9rem',
                  backgroundColor: ownerFilter === filter ? 'var(--accent)' : 'var(--background)',
                  color: ownerFilter === filter ? 'white' : 'var(--foreground)',
                  border: '1px solid var(--border)'
                }}
              >
                {filter === 'all' ? 'All Wins' : filter === 'mine' ? 'My Wins' : 'Others'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['all', 'Milestone', 'Goal', 'Task', 'General'] as CategoryFilter[]).map(filter => (
            <button
              key={filter}
              onClick={() => setCategoryFilter(filter)}
              className="planner-button"
              style={{
                padding: '6px 12px',
                fontSize: '0.85rem',
                backgroundColor: categoryFilter === filter ? '#212529' : 'var(--background)',
                color: categoryFilter === filter ? 'white' : 'var(--foreground)',
                border: '1px solid var(--border)'
              }}
            >
              {filter === 'all' ? `All (${totals.total})` : `${filter}s (${totals[filter]})`}
            </button>
          ))}
        </div>
      </div>

  {filteredWins.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px',
            backgroundColor: 'var(--paper)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            color: 'var(--text-muted)'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏆</div>
          <h3 style={{ margin: '0 0 8px 0', fontFamily: 'Georgia, serif', color: 'var(--foreground)' }}>
            No wins yet
          </h3>
          <p style={{ margin: 0 }}>
            {ownerFilter === 'mine'
              ? 'Complete goals or milestones to share your wins with the circle.'
              : ownerFilter === 'others'
                ? 'Circle members have not shared any wins yet.'
                : 'No wins match the selected filters right now.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredWins.map(win => {
            const ownerName = userProfiles[win.user_id] || 'Member';
            const color = getMemberColor(win.user_id);
            const initials = getInitials(ownerName);

            return (
              <div
                key={win.id}
                style={{
                  backgroundColor: 'var(--paper)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1rem'
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 'bold',
                        color: 'var(--foreground)',
                        fontSize: '1rem'
                      }}
                    >
                      {ownerName}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {formatDate(win.created_at)}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Tag label={win.category} tone={toneForCategory(win.category)} />
                    {win.goals?.horizon && (
                      <Tag label={formatHorizon(win.goals.horizon)} tone="#6f42c1" />
                    )}
                  </div>
                </div>

                <div>
                  <h4
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '1.2rem',
                      color: 'var(--foreground)',
                      fontFamily: 'Georgia, serif'
                    }}
                  >
                    {win.title}
                  </h4>
                  {win.description && (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                      {win.description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {win.goal_title && (
                    <RelationPill label={`Goal: ${win.goal_title}`} tone="#0d6efd" />
                  )}
                  {win.milestone_title && (
                    <RelationPill label={`Milestone: ${win.milestone_title}`} tone="#198754" />
                  )}
                  {win.task_id && !win.goal_title && !win.milestone_title && (
                    <RelationPill label="Task Win" tone="#fd7e14" />
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

function determineCategory(win: RawWin): DisplayWin['category'] {
  if (win.milestone_id) return 'Milestone';
  if (win.goal_id) return 'Goal';
  if (win.task_id) return 'Task';
  return 'General';
}

function getMemberColor(userId: string) {
  const palette = ['#6f42c1', '#0d6efd', '#198754', '#fd7e14', '#dc3545', '#20c997', '#0dcaf0', '#6610f2'];
  const index = parseInt(userId.slice(-2), 16) % palette.length;
  return palette[index];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatHorizon(horizon: 'long-term' | 'medium-term' | 'short-term' | null) {
  if (!horizon) return '';
  if (horizon === 'long-term') return 'Long-term Goal';
  if (horizon === 'medium-term') return 'Medium-term Goal';
  return 'Short-term Goal';
}

function toneForCategory(category: DisplayWin['category']) {
  switch (category) {
    case 'Milestone':
      return '#198754';
    case 'Goal':
      return '#0d6efd';
    case 'Task':
      return '#fd7e14';
    default:
      return '#6c757d';
  }
}

function Tag({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      style={{
        backgroundColor: tone,
        color: 'white',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.3px'
      }}
    >
      {label}
    </span>
  );
}

function RelationPill({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        color: tone,
        padding: '6px 12px',
        borderRadius: '18px',
        fontSize: '0.85rem',
        border: `1px solid ${tone}33`
      }}
    >
      {label}
    </span>
  );
}

