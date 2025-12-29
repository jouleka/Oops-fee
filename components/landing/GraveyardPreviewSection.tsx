/**
 * GraveyardPreviewSection - Dramatic graveyard preview with animated tombstones
 * Shows sample failed promises with hover-reveal cause of death
 */

import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────
// TOMBSTONE DATA
// ─────────────────────────────────────────────────────────────

interface TombstoneData {
  promise: string;
  duration: string;
  amount: string;
  causeOfDeath: string;
  epitaph: string;
}

const TOMBSTONES: TombstoneData[] = [
  {
    promise: 'Go to the gym 3x/week',
    duration: '4 days',
    amount: '$50',
    causeOfDeath: '"Just one rest day" became four',
    epitaph: 'RIP gains',
  },
  {
    promise: 'No social media before noon',
    duration: '36 hours',
    amount: '$25',
    causeOfDeath: 'Opened Instagram "just to check one thing"',
    epitaph: 'Scrolled into oblivion',
  },
  {
    promise: 'Read 20 pages every day',
    duration: '9 days',
    amount: '$30',
    causeOfDeath: 'Netflix had other plans',
    epitaph: 'Never finished chapter 3',
  },
  {
    promise: 'No junk food for a month',
    duration: '6 days',
    amount: '$40',
    causeOfDeath: 'The pizza looked too good',
    epitaph: 'It was worth it... was it?',
  },
  {
    promise: 'Wake up at 6am',
    duration: '2 days',
    amount: '$35',
    causeOfDeath: 'Snoozed 47 times',
    epitaph: '5 more minutes...',
  },
];

// ─────────────────────────────────────────────────────────────
// TOMBSTONE COMPONENT
// ─────────────────────────────────────────────────────────────

interface TombstoneProps {
  data: TombstoneData;
  index: number;
  isVisible: boolean;
}

function Tombstone({ data, index, isVisible }: TombstoneProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isVisible && !hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, index * 150);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible, hasAnimated, index]);

  return (
    <div
      className={`relative group cursor-pointer transition-all duration-500 ${
        hasAnimated
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-24'
      }`}
      style={{
        animationDelay: `${index * 150}ms`,
        transform: hasAnimated
          ? `rotate(${(index % 2 === 0 ? -1 : 1) * (1 + index * 0.5)}deg)`
          : 'translateY(100px)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ground shadow */}
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-4 rounded-[100%] bg-black/40 blur-md transition-all duration-300"
        style={{
          transform: `translateX(-50%) scale(${isHovered ? 1.2 : 1})`,
        }}
      />

      {/* Tombstone body */}
      <div
        className={`relative bg-gradient-to-b from-neutral-700 via-neutral-800 to-neutral-900 rounded-t-[3rem] md:rounded-t-[4rem] w-44 sm:w-52 md:w-56 overflow-hidden transition-all duration-300 ${
          isHovered ? 'scale-105 -translate-y-2' : ''
        }`}
        style={{
          boxShadow: isHovered
            ? '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 10px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Weathered texture overlay */}
        <div className="absolute inset-0 opacity-30 mix-blend-overlay bg-noise pointer-events-none" />

        {/* Cracks decoration */}
        <svg
          className="absolute top-1/3 left-2 w-8 h-16 opacity-20"
          viewBox="0 0 20 40"
          fill="none"
        >
          <path
            d="M10 0 L8 10 L12 15 L7 25 L10 35 L9 40"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-black"
          />
        </svg>

        <div className="relative z-10 px-6 py-8 text-center">
          {/* RIP header */}
          <div className="text-neutral-500 text-xs font-mono tracking-[0.4em] mb-3">
            R.I.P.
          </div>

          {/* Cross decoration */}
          <div className="flex justify-center mb-4">
            <div className="relative w-8 h-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-10 bg-neutral-600 rounded-sm" />
              <div className="absolute top-2 left-0 w-8 h-1.5 bg-neutral-600 rounded-sm" />
            </div>
          </div>

          {/* Promise text */}
          <p className="text-white font-medium text-sm md:text-base leading-tight mb-4 line-clamp-2 min-h-[2.5rem]">
            &ldquo;{data.promise}&rdquo;
          </p>

          {/* Divider line */}
          <div className="w-12 h-px bg-neutral-600 mx-auto mb-4" />

          {/* Duration and amount */}
          <div className="flex justify-center gap-4 text-xs mb-4">
            <div>
              <span className="text-neutral-500 block">Survived</span>
              <span className="text-danger-500 font-mono font-bold">{data.duration}</span>
            </div>
            <div className="w-px bg-neutral-700" />
            <div>
              <span className="text-neutral-500 block">Lost</span>
              <span className="text-danger-500 font-mono font-bold">{data.amount}</span>
            </div>
          </div>

          {/* Epitaph */}
          <p className="text-neutral-400 text-xs italic min-h-[1rem]">
            {data.epitaph}
          </p>
        </div>

        {/* Hover overlay - Cause of death */}
        <div
          className={`absolute inset-0 rounded-t-[3rem] md:rounded-t-[4rem] bg-gradient-to-t from-danger-500 via-danger-500/95 to-danger-500/90 flex flex-col items-center justify-center p-4 md:p-6 transition-all duration-300 z-20 ${
            isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="text-white/80 text-xs font-mono tracking-widest mb-3 uppercase">
            Cause of Death
          </div>
          <p className="text-white text-center font-semibold text-base leading-snug max-w-[180px]">
            {data.causeOfDeath}
          </p>
          <div className="mt-5 text-4xl">🪦</div>
        </div>
      </div>

      {/* Dirt mound at base */}
      <div className="relative h-4 mx-4">
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-neutral-900 via-neutral-800 to-transparent rounded-t-full" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SECTION COMPONENT
// ─────────────────────────────────────────────────────────────

export function GraveyardPreviewSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 md:py-32 overflow-hidden"
    >
      {/* Dark moody background */}
      <div className="absolute inset-0 bg-gradient-to-b from-abyss-900 via-neutral-900 to-abyss-900" />

      {/* Fog effect at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(255,255,255,0.03) 0%, transparent 100%)',
        }}
      />

      {/* Subtle red glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[60%] pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255, 59, 48, 0.15) 0%, transparent 70%)',
        }}
      />

      {/* Floating particles/dust */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/10"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `parallax-float ${6 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
        {/* Section header */}
        <div
          className={`text-center mb-16 md:mb-20 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="inline-block text-danger-500 text-xs font-mono uppercase tracking-[0.3em] mb-4">
            The Graveyard
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-white tracking-tight mb-6">
            Here lies{' '}
            <span className="text-gradient-danger relative">
              your excuses
              {/* Glitch effect on hover */}
              <span className="absolute inset-0 text-gradient-danger animate-glitch-hover opacity-0 hover:opacity-100" />
            </span>
          </h2>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Every broken promise gets a permanent memorial. Hover to see what really happened.
            <span className="text-danger-500"> Don&apos;t let yours end up here.</span>
          </p>
        </div>

        {/* Tombstones grid - horizontal scroll on mobile, wrap on larger screens */}
        <div className="flex overflow-x-auto md:overflow-visible md:flex-wrap justify-start md:justify-center items-end gap-4 md:gap-6 lg:gap-8 mb-16 pb-4 md:pb-0 -mx-6 px-6 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none">
          {TOMBSTONES.map((tombstone, index) => (
            <div key={tombstone.promise} className="snap-center flex-shrink-0 md:flex-shrink">
              <Tombstone
                data={tombstone}
                index={index}
                isVisible={isVisible}
              />
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div
          className={`text-center transition-all duration-700 delay-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="inline-flex items-center gap-4 glass-dark rounded-full px-6 py-3">
            <span className="text-2xl">⚰️</span>
            <p className="text-neutral-300 text-sm md:text-base">
              <span className="text-danger-500 font-mono font-bold">2,847</span> promises buried this month
            </p>
            <span className="text-2xl">⚰️</span>
          </div>
        </div>
      </div>
    </section>
  );
}

