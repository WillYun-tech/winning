'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function PlannerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { name: 'Goals', href: '/planner/goals', icon: '🎯' },
    { name: 'Habits', href: '/planner/habits', icon: '📈' },
    { name: 'Routines', href: '/planner/routines', icon: '🌅' },
    { name: 'Month', href: '/planner/month', icon: '📅' },
    { name: 'Weekly', href: '/planner/week', icon: '📋' },
    { name: 'Daily', href: '/planner/day', icon: '📝' },
    { name: 'Wins', href: '/planner/wins', icon: '🏆' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      {/* Personal Planner Header */}
      <div style={{
        backgroundColor: 'var(--paper)',
        borderBottom: '1px solid var(--border)',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 4px var(--shadow)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{
            fontSize: '2.5rem',
            margin: '0 0 12px 0',
            color: 'var(--accent)',
            fontFamily: 'Georgia, serif',
            fontWeight: 'bold'
          }}>
            📖 My Planner
          </h1>
          <p style={{ 
            color: 'var(--text-muted)', 
            margin: 0, 
            fontSize: '1.1rem',
            fontStyle: 'italic'
          }}>
            Your personal planning sanctuary
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        backgroundColor: 'var(--paper)',
        borderBottom: '1px solid var(--border)',
        marginBottom: '24px',
        boxShadow: '0 2px 4px var(--shadow)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <nav style={{ display: 'flex', gap: '0' }}>
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '16px 24px',
                    textDecoration: 'none',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                    backgroundColor: isActive ? 'rgba(107, 91, 149, 0.1)' : 'transparent',
                    fontWeight: isActive ? 'bold' : '500',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit'
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>{tab.icon}</span>
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        {children}
      </div>
    </div>
  );
}
