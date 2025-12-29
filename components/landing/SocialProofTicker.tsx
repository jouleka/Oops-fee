/**
 * Social Proof Ticker Bar
 * Scrolling ticker with animated counters showing app activity
 * Creates urgency and FOMO
 */

import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────
// ANIMATED COUNTER COMPONENT
// ─────────────────────────────────────────────────────────────

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

function AnimatedCounter({ value, prefix = '', suffix = '', className = '' }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValue = useRef(value);

  useEffect(() => {
    if (value !== previousValue.current) {
      setIsAnimating(true);
      
      // Animate to new value
      const startValue = previousValue.current;
      const endValue = value;
      const duration = 800;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startValue + (endValue - startValue) * eased);
        
        setDisplayValue(current);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          previousValue.current = value;
        }
      };

      requestAnimationFrame(animate);
    }
  }, [value]);

  const formattedValue = displayValue.toLocaleString();

  return (
    <span className={`font-mono tabular-nums ${isAnimating ? 'text-lime-300' : ''} ${className}`}>
      {prefix}{formattedValue}{suffix}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// TICKER ITEM COMPONENT
// ─────────────────────────────────────────────────────────────

interface TickerItemProps {
  icon: string;
  text: string;
  value: number;
  prefix?: string;
  suffix?: string;
  valueClass?: string;
}

function TickerItem({ icon, text, value, prefix, suffix, valueClass = 'text-lime-400' }: TickerItemProps) {
  return (
    <div className="inline-flex items-center gap-3 mx-8 py-2">
      <span className="text-lg">{icon}</span>
      <span className="text-neutral-400">
        {text.split('{value}')[0]}
        <AnimatedCounter 
          value={value} 
          prefix={prefix} 
          suffix={suffix}
          className={`font-semibold ${valueClass}`}
        />
        {text.split('{value}')[1]}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SEPARATOR DOT
// ─────────────────────────────────────────────────────────────

function Separator() {
  return (
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime-400/40 mx-6" />
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN TICKER COMPONENT
// ─────────────────────────────────────────────────────────────

interface SocialProofTickerProps {
  className?: string;
}

export function SocialProofTicker({ className = '' }: SocialProofTickerProps) {
  // Live-ish stats that tick up periodically
  const [stats, setStats] = useState({
    promisesKeptToday: 847,
    activeStakes: 12450,
    promisesLive: 234,
    successRate: 73,
    moneyOnLine: 48750,
  });

  // Periodically increment stats to create "live" feel
  useEffect(() => {
    const intervals: ReturnType<typeof setInterval>[] = [];

    // Promises kept - increment every 15-45 seconds
    intervals.push(
      setInterval(() => {
        setStats(prev => ({
          ...prev,
          promisesKeptToday: prev.promisesKeptToday + Math.floor(Math.random() * 3) + 1,
        }));
      }, Math.random() * 30000 + 15000)
    );

    // Active stakes - small fluctuation every 20-40 seconds
    intervals.push(
      setInterval(() => {
        setStats(prev => ({
          ...prev,
          activeStakes: prev.activeStakes + Math.floor(Math.random() * 200) - 50,
        }));
      }, Math.random() * 20000 + 20000)
    );

    // Promises live - fluctuate every 10-30 seconds
    intervals.push(
      setInterval(() => {
        setStats(prev => ({
          ...prev,
          promisesLive: Math.max(100, prev.promisesLive + Math.floor(Math.random() * 20) - 8),
        }));
      }, Math.random() * 20000 + 10000)
    );

    // Money on the line - increment every 8-20 seconds
    intervals.push(
      setInterval(() => {
        setStats(prev => ({
          ...prev,
          moneyOnLine: prev.moneyOnLine + Math.floor(Math.random() * 150) + 25,
        }));
      }, Math.random() * 12000 + 8000)
    );

    return () => intervals.forEach(clearInterval);
  }, []);

  const tickerItems = [
    {
      icon: '✅',
      text: '{value} promises kept today',
      value: stats.promisesKeptToday,
    },
    {
      icon: '💰',
      text: '{value} staked right now',
      value: stats.moneyOnLine,
      prefix: '$',
      valueClass: 'text-lime-400',
    },
    {
      icon: '🔥',
      text: '{value} active promises',
      value: stats.promisesLive,
    },
    {
      icon: '📈',
      text: '{value} success rate',
      value: stats.successRate,
      suffix: '%',
      valueClass: 'text-lime-400',
    },
    {
      icon: '👥',
      text: '{value} users holding themselves accountable',
      value: stats.activeStakes,
    },
  ];

  return (
    <section 
      className={`relative overflow-hidden border-y border-neutral-800/50 bg-abyss-800/50 backdrop-blur-sm ${className}`}
    >
      {/* Gradient fade edges - increased width for LIVE indicator space */}
      <div className="absolute left-0 top-0 bottom-0 w-32 md:w-40 bg-gradient-to-r from-abyss-800 via-abyss-800/90 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-abyss-800 to-transparent z-10 pointer-events-none" />
      
      {/* Live indicator - positioned in gradient fade area */}
      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 bg-abyss-800/80 px-2 py-1 rounded-full">
        <div className="relative">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-lime-400" />
          </span>
        </div>
        <span className="text-xs font-mono uppercase tracking-wider text-lime-400/80 hidden sm:inline">
          Live
        </span>
      </div>

      {/* Ticker container - added left padding to avoid LIVE indicator overlap */}
      <div className="ticker-container py-3 pl-24 md:pl-32">
        {/* We duplicate content twice for seamless loop */}
        <div className="ticker-content hover:pause">
          {/* First set */}
          {tickerItems.map((item, i) => (
            <span key={`a-${i}`}>
              <TickerItem {...item} />
              <Separator />
            </span>
          ))}
          {/* Duplicate for seamless loop */}
          {tickerItems.map((item, i) => (
            <span key={`b-${i}`}>
              <TickerItem {...item} />
              <Separator />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

