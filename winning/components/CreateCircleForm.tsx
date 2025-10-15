'use client';

import { useState } from 'react';

export default function CreateCircleForm() {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/circles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) return setError(json.error || 'Failed to create circle');
    window.location.href = `/c/${json.id}`;
  }

  return (
    <form onSubmit={onSubmit}>
      <input
        placeholder="Circle name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create circle'}
      </button>
      {error && <p>{error}</p>}
    </form>
  );
}