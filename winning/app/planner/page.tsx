'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlannerPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to goals page by default
    router.replace('/planner/goals');
  }, [router]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <p>Redirecting to your goals...</p>
    </div>
  );
}
