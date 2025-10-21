'use client';

import { SignOutButton } from '@/components/SignOutButton';
import CircleSwitcher from '@/components/CircleSwitcher';

export default function TopBar() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '16px 20px',
      backgroundColor: 'var(--paper)',
      borderBottom: '1px solid var(--border)',
      boxShadow: '0 2px 4px var(--shadow)'
    }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <a href="/" style={{ 
          textDecoration: 'none', 
          color: 'var(--accent)', 
          fontWeight: 'bold', 
          fontSize: '1.4rem',
          fontFamily: 'Georgia, serif'
        }}>
          ✨ Winning
        </a>
        <a href="/planner" style={{ 
          textDecoration: 'none', 
          color: 'var(--text-muted)', 
          padding: '8px 16px', 
          borderRadius: '6px',
          transition: 'all 0.2s ease',
          fontWeight: '500'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--accent)';
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}>
          📋 My Planner
        </a>
        <a href="/circles" style={{ 
          textDecoration: 'none', 
          color: 'var(--text-muted)', 
          padding: '8px 16px', 
          borderRadius: '6px',
          transition: 'all 0.2s ease',
          fontWeight: '500'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--accent)';
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}>
          👥 Circles
        </a>
      </div>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <CircleSwitcher />
        <SignOutButton />
      </div>
    </div>
  );
}
