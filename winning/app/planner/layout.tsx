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
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Personal Planner Header */}
      <div style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e0e0e0',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            margin: '0 0 10px 0',
            color: '#000'
          }}>
            My Planner
          </h1>
          <p style={{ color: '#666', margin: 0, fontSize: '1.1rem' }}>
            Your personal planning space
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e0e0e0',
        marginBottom: '20px'
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
                    gap: '8px',
                    padding: '15px 20px',
                    textDecoration: 'none',
                    color: isActive ? '#007bff' : '#666',
                    borderBottom: isActive ? '3px solid #007bff' : '3px solid transparent',
                    backgroundColor: isActive ? '#f8f9ff' : 'transparent',
                    fontWeight: isActive ? 'bold' : 'normal',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>{tab.icon}</span>
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        {children}
      </div>
    </div>
  );
}
