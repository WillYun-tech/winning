'use client';

import { useParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function CirclePage() {
  const params = useParams();
  const circleId = params.circleId as string;
  const supabase = createBrowserSupabaseClient();
  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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
  }, [circleId, supabase]);

  if (loading) return <p>Loading circle...</p>;
  if (!circle) return <p>Circle not found</p>;

  return (
    <div>
      <h1>{circle.name}</h1>
      <p>Circle ID: {circle.id}</p>
      <p>Created: {new Date(circle.created_at).toLocaleDateString()}</p>
    </div>
  );
}