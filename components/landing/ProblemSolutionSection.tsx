/**
 * Problem/Solution Section with Timeline and Wallet Animations
 * Shows failed resolutions being scratched out vs the promise locking solution
 */

import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────
// FAILED RESOLUTIONS DATA
// ─────────────────────────────────────────────────────────────

const FAILED_RESOLUTIONS = [
  { date: 'Jan 1, 2025', resolution: 'Go to the gym 4x a week', failedAt: 'Day 12' },
  { date: 'Feb 14, 2025', resolution: 'Quit smoking for good', failedAt: 'Day 6' },
  { date: 'Mar 1, 2025', resolution: 'Learn to cook healthy meals', failedAt: 'Day 3' },
  { date: 'Apr 15, 2025', resolution: 'Wake up at 6am every day', failedAt: 'Day 2' },
  { date: 'May 1, 2025', resolution: 'Read 30 minutes daily', failedAt: 'Day 8' },
];

// ─────────────────────────────────────────────────────────────
// TIMELINE ITEM COMPONENT
// ─────────────────────────────────────────────────────────────

function TimelineItem({
  date,
  resolution,
  failedAt,
  index,
  isVisible,
}: {
  date: string;
  resolution: string;
  failedAt: string;
  index: number;
  isVisible: boolean;
}) {
  const [isScratched, setIsScratched] = useState(false);

  useEffect(() => {
    if (!isVisible) return;
    
    const timer = setTimeout(() => {
      setIsScratched(true);
    }, 500 + index * 300);
    return () => clearTimeout(timer);
  }, [isVisible, index]);

  return (
    <div
      className={`relative flex items-start gap-4 transition-all duration-700 ${
        isVisible
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 -translate-x-8'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Timeline dot and line */}
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full transition-all duration-500 ${
            isScratched
              ? 'bg-danger-500 shadow-[0_0_12px_rgba(255,59,48,0.6)]'
              : 'bg-neutral-600'
          }`}
        />
        {index < FAILED_RESOLUTIONS.length - 1 && (
          <div className="w-0.5 h-16 bg-neutral-800" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 -mt-1 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <span
            className={`text-xs font-mono transition-all duration-500 ${
              isScratched ? 'text-danger-500' : 'text-neutral-500'
            }`}
          >
            {date}
          </span>
          {isScratched && (
            <span className="text-[10px] font-mono text-danger-400 bg-danger-500/10 px-2 py-0.5 rounded-full animate-fade-in">
              FAILED {failedAt}
            </span>
          )}
        </div>
        <p
          className={`text-base leading-relaxed transition-all duration-500 relative ${
            isScratched ? 'text-neutral-600' : 'text-neutral-300'
          }`}
        >
          {resolution}
          {/* Strikethrough line animation */}
          <span
            className={`absolute left-0 top-1/2 h-0.5 bg-danger-500/60 transition-all duration-700 ease-out ${
              isScratched ? 'w-full' : 'w-0'
            }`}
            style={{ transitionDelay: `${index * 100 + 200}ms` }}
          />
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ANIMATED WALLET COMPONENT
// ─────────────────────────────────────────────────────────────

function AnimatedWallet({ isVisible }: { isVisible: boolean }) {
  const [step, setStep] = useState(0);
  // 0: closed wallet, 1: wallet opens, 2: money slides in, 3: lock clicks

  useEffect(() => {
    if (!isVisible) {
      setStep(0);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setStep(1), 500)); // Open wallet
    timers.push(setTimeout(() => setStep(2), 1200)); // Money slides in
    timers.push(setTimeout(() => setStep(3), 2000)); // Lock clicks

    return () => timers.forEach(clearTimeout);
  }, [isVisible]);

  return (
    <div className="relative w-64 h-48 mx-auto">
      {/* Glow effect */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          step >= 3 ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(191, 255, 0, 0.2) 0%, transparent 60%)',
          filter: 'blur(30px)',
          transform: 'scale(1.5)',
        }}
      />

      {/* Wallet body */}
      <div
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-52 h-32 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 shadow-2xl transition-all duration-500 ${
          step >= 1 ? 'scale-100' : 'scale-90 opacity-80'
        }`}
      >
        {/* Wallet interior */}
        <div className="absolute inset-2 rounded-xl bg-neutral-850 border border-neutral-700/50" />

        {/* Card slots */}
        <div className="absolute top-4 left-4 right-4 space-y-1.5">
          <div className="h-2 bg-neutral-700/50 rounded-full w-3/4" />
          <div className="h-2 bg-neutral-700/50 rounded-full w-1/2" />
        </div>

        {/* Money compartment indicator */}
        <div className="absolute bottom-4 left-4 right-4 h-12 rounded-lg bg-neutral-700/30 border border-neutral-600/30 flex items-center justify-center overflow-hidden">
          {/* Dollar bills sliding in */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`absolute w-16 h-7 rounded bg-gradient-to-r from-green-600 to-green-700 border border-green-500/30 flex items-center justify-center font-mono text-green-300 text-sm font-bold shadow-lg transition-all duration-700 ${
                step >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
              }`}
              style={{
                transitionDelay: `${i * 150}ms`,
                left: `${20 + i * 24}%`,
                transform: step >= 2 ? `rotate(${-5 + i * 5}deg)` : undefined,
              }}
            >
              $25
            </div>
          ))}
        </div>
      </div>

      {/* Wallet flap (opens) */}
      <div
        className={`absolute bottom-24 left-1/2 -translate-x-1/2 w-52 h-16 rounded-t-2xl origin-bottom transition-all duration-700 ease-out ${
          step >= 1
            ? 'bg-gradient-to-b from-neutral-700 to-neutral-800 [transform:perspective(500px)_rotateX(-60deg)]'
            : 'bg-gradient-to-b from-neutral-800 to-neutral-900 [transform:perspective(500px)_rotateX(0deg)]'
        }`}
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Clasp/lock */}
        <div
          className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
            step >= 3
              ? 'bg-lime-400 shadow-[0_0_20px_rgba(191,255,0,0.6)] scale-100'
              : 'bg-neutral-600 scale-90'
          } ${step === 3 ? 'animate-lock-click' : ''}`}
        >
          {step >= 3 ? (
            <svg
              className="w-4 h-4 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Success message */}
      <div
        className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap transition-all duration-500 ${
          step >= 3
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        }`}
      >
        <span className="text-sm font-mono text-lime-400">
          Promise locked 🔒
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SECTION COMPONENT
// ─────────────────────────────────────────────────────────────

export function ProblemSolutionSection() {
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
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-abyss-900 via-neutral-900/50 to-abyss-900" />

      {/* Decorative elements */}
      <div
        className="gradient-orb gradient-orb-red absolute w-72 h-72 -left-20 top-1/4 opacity-40"
        style={{ animationDelay: '1s' }}
      />
      <div
        className="gradient-orb gradient-orb-lime absolute w-64 h-64 -right-20 bottom-1/4 opacity-30"
        style={{ animationDelay: '3s' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
        {/* Section header */}
        <div
          className={`text-center mb-16 md:mb-20 transition-all duration-700 ${
            isVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-neutral-500 mb-4 block">
            The reality check
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-tight">
            <span className="text-white">Why willpower </span>
            <span className="text-gradient-danger">doesn&apos;t work</span>
          </h2>
        </div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* LEFT: The Problem - Failed Timeline */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-12'
            }`}
          >
            <div className="relative">
              {/* Card container */}
              <div className="relative bg-neutral-900/80 backdrop-blur-sm rounded-2xl border border-neutral-800 p-6 md:p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 rounded-full bg-danger-500 animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-widest text-danger-400">
                    The Problem
                  </span>
                </div>

                <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">
                  Your resolution graveyard
                </h3>
                <p className="text-neutral-400 text-sm mb-8">
                  Every promise you made to yourself. Every time you gave up.
                </p>

                {/* Timeline */}
                <div className="space-y-0">
                  {FAILED_RESOLUTIONS.map((item, index) => (
                    <TimelineItem
                      key={index}
                      {...item}
                      index={index}
                      isVisible={isVisible}
                    />
                  ))}
                </div>

                {/* Fade overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-neutral-900/80 to-transparent rounded-b-2xl pointer-events-none" />

                {/* "And more..." text */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <span className="text-neutral-600 text-xs font-mono">
                    ...and 47 more
                  </span>
                </div>
              </div>

              {/* Decorative corner */}
              <div className="absolute -top-2 -left-2 w-6 h-6 border-l-2 border-t-2 border-danger-500/30 rounded-tl-lg" />
              <div className="absolute -bottom-2 -right-2 w-6 h-6 border-r-2 border-b-2 border-danger-500/30 rounded-br-lg" />
            </div>
          </div>

          {/* RIGHT: The Solution - Animated Wallet */}
          <div
            className={`transition-all duration-700 delay-400 ${
              isVisible
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 translate-x-12'
            }`}
          >
            <div className="relative">
              {/* Card container */}
              <div className="relative bg-neutral-900/80 backdrop-blur-sm rounded-2xl border border-neutral-800 p-6 md:p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 rounded-full bg-lime-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-widest text-lime-400">
                    The Solution
                  </span>
                </div>

                <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">
                  Make failure hurt
                </h3>
                <p className="text-neutral-400 text-sm mb-8">
                  When real money is on the line, you show up differently.
                </p>

                {/* Wallet animation area */}
                <div className="py-8">
                  <AnimatedWallet isVisible={isVisible} />
                </div>

                {/* Steps */}
                <div className="mt-8 space-y-4">
                  {[
                    { step: '1', text: 'Open your wallet' },
                    { step: '2', text: 'Stake real money' },
                    { step: '3', text: 'Promise locks in' },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-4 transition-all duration-500 ${
                        isVisible
                          ? 'opacity-100 translate-x-0'
                          : 'opacity-0 translate-x-4'
                      }`}
                      style={{ transitionDelay: `${800 + i * 150}ms` }}
                    >
                      <div className="w-6 h-6 rounded-full bg-lime-400/10 border border-lime-400/30 flex items-center justify-center">
                        <span className="text-xs font-mono text-lime-400">
                          {item.step}
                        </span>
                      </div>
                      <span className="text-sm text-neutral-300">
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decorative corner */}
              <div className="absolute -top-2 -left-2 w-6 h-6 border-l-2 border-t-2 border-lime-400/30 rounded-tl-lg" />
              <div className="absolute -bottom-2 -right-2 w-6 h-6 border-r-2 border-b-2 border-lime-400/30 rounded-br-lg" />
            </div>
          </div>
        </div>

        {/* Bottom callout */}
        <div
          className={`mt-16 text-center transition-all duration-700 delay-600 ${
            isVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-neutral-400 max-w-2xl mx-auto">
            <span className="text-white font-medium">Loss aversion is real:</span>{' '}
            losing{' '}
            <span className="font-mono text-lime-400">$25</span>{' '}
            hurts{' '}
            <span className="text-danger-400">2.5x more</span>{' '}
            than gaining $25 feels good. Use that against yourself.
          </p>
        </div>
      </div>
    </section>
  );
}

