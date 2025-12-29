/**
 * FeaturesGrid - Verification features section with 3D tilt cards
 * Grid layout with staggered reveal animations
 */

import type { FeatureType } from './FeatureCard';
import { FeatureCard } from './FeatureCard';

// ─────────────────────────────────────────────────────────────
// FEATURE DATA
// ─────────────────────────────────────────────────────────────

const FEATURES: {
  type: FeatureType;
  title: string;
  description: string;
}[] = [
  {
    type: 'voice',
    title: 'Voice Commitment',
    description:
      'Record yourself making the promise. When you try to quit, you hear your own voice. Try lying to that.',
  },
  {
    type: 'photo',
    title: 'Photo Proof',
    description:
      'No gallery picks. Take a real photo when you complete. No proof? No completion.',
  },
  {
    type: 'friend',
    title: 'Friend Verification',
    description:
      "Assign a friend as your witness. They confirm you did it — or they don't. Their call.",
  },
  {
    type: 'graveyard',
    title: 'The Graveyard',
    description:
      'Every broken promise gets a tombstone. How long it lasted. How much you lost. Forever.',
  },
];

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export function FeaturesGrid() {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-abyss-900 via-neutral-900/50 to-abyss-900" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12">
        {/* Section header */}
        <div className="text-center mb-16 md:mb-20">
          <span className="inline-block text-lime-400 text-xs font-mono uppercase tracking-[0.3em] mb-4">
            Verification
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-white tracking-tight mb-6">
            No cheating.{' '}
            <span className="text-gradient-danger">No excuses.</span>
          </h2>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Every promise needs proof. Pick your verification method — 
            then actually follow through. Or don&apos;t. We&apos;ll remember.
          </p>
        </div>

        {/* Features grid */}
        <div className="flex flex-wrap justify-center gap-6">
          {FEATURES.map((feature, index) => (
            <FeatureCard
              key={feature.type}
              type={feature.type}
              title={feature.title}
              description={feature.description}
              index={index}
            />
          ))}
        </div>

        {/* Bottom decorative element */}
        <div className="flex justify-center mt-16 md:mt-20">
          <div className="flex items-center gap-3 text-neutral-500 text-sm">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-neutral-700" />
            <span className="font-mono text-xs tracking-wider">TRUST NOTHING. VERIFY EVERYTHING.</span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-neutral-700" />
          </div>
        </div>
      </div>
    </section>
  );
}

