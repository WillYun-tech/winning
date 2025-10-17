'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type Circle = { id: string; name: string; role: string };

export default function CircleSwitcher() {
  const supabase = createBrowserSupabaseClient();
  const router = useRouter();
  const pathname = usePathname();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [currentCircleId, setCurrentCircleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('circle_members')
        .select('circle_id, role, circles:circle_id (id, name)')
        .eq('user_id', session.user.id)
        .order('joined_at', { ascending: false });

      if (data) {
        const circleList = data.map((m: any) => ({
          id: m.circles.id,
          name: m.circles.name,
          role: m.role
        }));
        setCircles(circleList);

        // Extract current circle ID from pathname
        const match = pathname.match(/^\/c\/([^\/]+)/);
        if (match) {
          setCurrentCircleId(match[1]);
        }
      }
      setLoading(false);
    })();
  }, [supabase, pathname]);

  function handleCircleChange(circleId: string) {
    router.push(`/c/${circleId}`);
  }

  if (loading) return <div>Loading circles...</div>;
  if (circles.length === 0) return null;

  return (
    <div>
      <label htmlFor="circle-select">Switch Circle: </label>
      <select
        id="circle-select"
        value={currentCircleId || ''}
        onChange={(e) => handleCircleChange(e.target.value)}
      >
        <option value="">Select a circle</option>
        {circles.map((circle) => (
          <option key={circle.id} value={circle.id}>
            {circle.name} ({circle.role})
          </option>
        ))}
      </select>
    </div>
  );
}
