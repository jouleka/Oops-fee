export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export function getTimeRemaining(
  deadlineAt: number,
  now: number = Date.now()
): { label: string; urgency: Urgency; msRemaining: number } {
  const msRemaining = deadlineAt - now;

  if (msRemaining <= 0) return { label: 'EXPIRED', urgency: 'critical', msRemaining };

  const totalMinutes = Math.floor(msRemaining / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours < 1) return { label: `${minutes}m`, urgency: 'critical', msRemaining };
  if (hours < 6) return { label: `${hours}h ${minutes}m`, urgency: 'high', msRemaining };

  // <24h should feel like a red-alert
  if (hours < 24) return { label: `${hours}h`, urgency: 'high', msRemaining };

  const days = Math.floor(hours / 24);
  
  // 1-3 days = medium urgency (getting close)
  if (days <= 3) return { label: `${days}d ${hours % 24}h`, urgency: 'medium', msRemaining };
  
  // 4+ days = low urgency (plenty of time)
  return { label: `${days}d ${hours % 24}h`, urgency: 'low', msRemaining };
}

export function formatShortDateTime(ms: number): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}


