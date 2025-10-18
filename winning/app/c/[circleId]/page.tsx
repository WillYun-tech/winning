'use client';

import { useParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CirclePage() {
  const params = useParams();
  const circleId = params.circleId as string;
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Check if user is a member of this circle
      const { data: membership } = await supabase
        .from('circle_members')
        .select('role')
        .eq('circle_id', circleId)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        // Not a member - redirect away
        router.push('/circles');
        return;
      }

      // User is a member - load circle data
      const { data, error } = await supabase
        .from('circles')
        .select('id, name, created_at')
        .eq('id', circleId)
        .single();
      
      if (error) {
        console.error(error);
        return;
      }
      setCircle(data);
      setLoading(false);
    })();
  }, [circleId, supabase, router]);

  async function createInvite() {
    setCreatingInvite(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { data, error } = await supabase
      .from('circle_invites')
      .insert({
        circle_id: circleId,
        inviter_id: user.id,
        role: 'member',
        token,
        expires_at: expiresAt.toISOString()
      })
      .select('token')
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setInviteToken(data.token);
    setCreatingInvite(false);
  }

  async function leaveCircle() {
    if (!confirm('Are you sure you want to leave this circle?')) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', user.id);

    if (error) {
      console.error(error);
      return;
    }

    window.location.href = '/circles';
  }

  function copyInviteLink() {
    const link = `${window.location.origin}/invite?token=${inviteToken}`;
    navigator.clipboard.writeText(link);
    alert('Invite link copied to clipboard!');
  }

  if (loading) return <p>Loading circle...</p>;
  if (!circle) return <p>Circle not found</p>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>{circle.name}</h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>
          Created {new Date(circle.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{ 
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        marginBottom: '30px'
      }}>
        <nav style={{ display: 'flex', gap: '0' }}>
          {[
            { name: 'Goals', href: `/c/${circleId}?tab=goals`, icon: '🎯' },
            { name: 'Habits', href: `/c/${circleId}?tab=habits`, icon: '📈' },
            { name: 'Routines', href: `/c/${circleId}?tab=routines`, icon: '🌅' },
            { name: 'Calendar', href: `/c/${circleId}?tab=month`, icon: '📅' },
            { name: 'Weekly', href: `/c/${circleId}?tab=week`, icon: '📋' },
            { name: 'Daily', href: `/c/${circleId}?tab=day`, icon: '📝' },
            { name: 'Wins', href: `/c/${circleId}?tab=wins`, icon: '🏆' },
          ].map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '15px 20px',
                textDecoration: 'none',
                color: '#666',
                borderBottom: '3px solid transparent',
                backgroundColor: 'transparent',
                fontWeight: 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{tab.icon}</span>
              <span>{tab.name}</span>
            </a>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div style={{ 
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '30px',
        marginBottom: '30px'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#000' }}>Circle Goals</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          View all circle members' goals together. Each member manages their own goals in their personal planner.
        </p>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>
            Goals view coming soon - this will show all circle members' goals combined
          </p>
          <a 
            href="/planner/goals"
            style={{
              display: 'inline-block',
              backgroundColor: '#007bff',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '5px',
              textDecoration: 'none',
              fontWeight: 'bold',
              marginTop: '10px'
            }}
          >
            Go to My Personal Goals
          </a>
        </div>
      </div>

      {/* Old Navigation Grid - Remove this section */}
      <div style={{ display: 'none' }}>

        {/* Habits Card */}
        <div style={{ 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>📈 Habits</h3>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            Track 10 habits daily with monthly grids and streak counters.
          </p>
          <a 
            href={`/c/${circleId}/habits`}
            style={{
              display: 'inline-block',
              backgroundColor: '#28a745',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '5px',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            Track Habits
          </a>
        </div>

        {/* Routines Card */}
        <div style={{ 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>🌅 Routines</h3>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            Create and track your morning and evening routines.
          </p>
          <a 
            href={`/c/${circleId}/routines`}
            style={{
              display: 'inline-block',
              backgroundColor: '#ffc107',
              color: 'black',
              padding: '10px 20px',
              borderRadius: '5px',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            Set Routines
          </a>
        </div>

        {/* Calendar Card */}
        <div style={{ 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>📅 Calendar</h3>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            Monthly view with events, tasks, and member activities.
          </p>
          <a 
            href={`/c/${circleId}/month`}
            style={{
              display: 'inline-block',
              backgroundColor: '#17a2b8',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '5px',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            View Calendar
          </a>
        </div>

        {/* Weekly Planning Card */}
        <div style={{ 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>📋 Weekly</h3>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            Review past week and plan upcoming week with focus areas.
          </p>
          <a 
            href={`/c/${circleId}/week`}
            style={{
              display: 'inline-block',
              backgroundColor: '#6f42c1',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '5px',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            Weekly Planning
          </a>
        </div>

        {/* Daily Planning Card */}
        <div style={{ 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>📝 Daily</h3>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            Daily priorities, schedule, to-dos, and notes.
          </p>
          <a 
            href={`/c/${circleId}/day`}
            style={{
              display: 'inline-block',
              backgroundColor: '#fd7e14',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '5px',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            Daily Planning
          </a>
        </div>

        {/* Wins Feed Card */}
        <div style={{ 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>🏆 Wins</h3>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            Celebrate achievements and see what your circle is accomplishing.
          </p>
          <a 
            href={`/c/${circleId}/wins`}
            style={{
              display: 'inline-block',
              backgroundColor: '#dc3545',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '5px',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            View Wins
          </a>
        </div>

        {/* Combined View Card */}
        <div style={{ 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px', 
          padding: '20px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>👥 Combined</h3>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            See everyone's plans together and spot conflicts or opportunities.
          </p>
          <a 
            href={`/c/${circleId}/combined`}
            style={{
              display: 'inline-block',
              backgroundColor: '#20c997',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '5px',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            Combined View
          </a>
        </div>
      </div>

      {/* Circle Management Section */}
      <div style={{ 
        border: '1px solid #e0e0e0', 
        borderRadius: '8px', 
        padding: '20px',
        backgroundColor: '#f8f9fa'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#333' }}>Circle Management</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <h4>Invite Members</h4>
          {!inviteToken ? (
            <button 
              onClick={createInvite} 
              disabled={creatingInvite}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '5px',
                cursor: creatingInvite ? 'not-allowed' : 'pointer'
              }}
            >
              {creatingInvite ? 'Creating...' : 'Create Invite Link'}
            </button>
          ) : (
            <div>
              <p>Invite link created! Share this link:</p>
              <input 
                value={`${window.location.origin}/invite?token=${inviteToken}`} 
                readOnly 
                style={{ 
                  width: '400px', 
                  marginRight: '10px',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
              <button 
                onClick={copyInviteLink}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Copy Link
              </button>
            </div>
          )}
        </div>

        <div>
          <button 
            onClick={leaveCircle}
            style={{ 
              backgroundColor: 'red', 
              color: 'white', 
              padding: '8px 16px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Leave Circle
          </button>
        </div>
      </div>
    </div>
  );
}