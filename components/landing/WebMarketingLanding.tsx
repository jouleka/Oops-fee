/**
 * Web Marketing Landing Page
 * Showcasing actual app features with clean, engaging design
 * Playful and edgy design with electric lime accents
 */

import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_STORE_URL, PLAY_STORE_URL } from '@/constants/app-stores';
import { CTASection } from './CTASection';
import { FeaturesGrid } from './FeaturesGrid';
import { Footer } from './Footer';
import { GraveyardPreviewSection } from './GraveyardPreviewSection';
import { HowItWorksSection } from './HowItWorksSection';
import { PhoneMockup } from './PhoneMockup';
import { ProblemSolutionSection } from './ProblemSolutionSection';
import { SocialProofTicker } from './SocialProofTicker';

// ─────────────────────────────────────────────────────────────
// FEATURE DATA (for native fallback)
// ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: 'Voice Commitment',
    description:
      'Record yourself making the promise. When you try to quit, you hear your own voice. Try lying to that.',
    visual: '🎙️',
  },
  {
    title: 'Photo Proof',
    description:
      'No gallery picks. Take a real photo when you complete. No proof? No completion.',
    visual: '📸',
  },
  {
    title: 'Friend Verification',
    description:
      "Assign a friend as your witness. They confirm you did it — or they don't. Their call.",
    visual: '👥',
  },
  {
    title: 'The Graveyard',
    description:
      'Every broken promise gets a tombstone. How long it lasted. How much you lost. Forever.',
    visual: '🪦',
  },
];

// ─────────────────────────────────────────────────────────────
// MECHANICS DATA
// ─────────────────────────────────────────────────────────────

const MECHANICS = [
  {
    title: 'Escalating Stakes',
    description:
      'Fail once? Next promise costs 2x. Fail again? 4x. Keep lying to yourself and it gets expensive fast.',
  },
  {
    title: 'Mean Notifications',
    description:
      'Day 7: friendly reminder. Day 1: "So we&apos;re really doing this?" Hour 1: just 🤡',
  },
  {
    title: 'Sponsor My Failure',
    description:
      'Share your promise. Friends can add money to your stake. Nothing like peer pressure with financial consequences.',
  },
  {
    title: '"I Told You So"',
    description:
      'Friends write a message you only see if you fail. Roast ready. Waiting. Watching.',
  },
];

// ─────────────────────────────────────────────────────────────
// WEB HERO SECTION - Animated, playful, and edgy
// ─────────────────────────────────────────────────────────────

function WebHeroSection({ onDownload }: { onDownload: (store: 'ios' | 'android') => void }) {
  const [showCursor, setShowCursor] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger load animation
    const loadTimer = setTimeout(() => setIsLoaded(true), 50);
    // Blinking cursor
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => {
      clearTimeout(loadTimer);
      clearInterval(cursorInterval);
    };
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-mesh" />
      
      {/* Noise texture overlay */}
      <div className="bg-noise absolute inset-0" />
      
      {/* Floating gradient orbs */}
      <div 
        className="gradient-orb gradient-orb-lime absolute w-96 h-96 -top-20 -left-20"
        style={{ animationDelay: '0s' }}
      />
      <div 
        className="gradient-orb gradient-orb-blue absolute w-80 h-80 top-1/3 -right-20"
        style={{ animationDelay: '2s' }}
      />
      <div 
        className="gradient-orb gradient-orb-red absolute w-64 h-64 bottom-20 left-1/4"
        style={{ animationDelay: '4s' }}
      />

      {/* Navigation */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-12 py-5 max-w-7xl mx-auto">
        <div 
          className={`font-display text-2xl tracking-tight text-white transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        >
          OopsFee
        </div>
        <button
          onClick={() => onDownload('ios')}
          className={`px-4 py-2 text-sm font-medium rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white hover:text-black transition-all duration-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
          style={{ animationDelay: '100ms' }}
        >
          Get the App
        </button>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20 px-6 md:px-12 pt-12 pb-24 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
        {/* Text content */}
        <div className="flex-1 max-w-2xl text-center lg:text-left">
          {/* Tagline with blinking cursor */}
          <div 
            className={`inline-flex items-center gap-2 mb-6 transition-all duration-700 delay-100 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <span className="text-lime-400 text-xs font-mono uppercase tracking-[0.3em]">
              Accountability App
            </span>
            <span 
              className={`inline-block w-0.5 h-4 bg-lime-400 transition-opacity ${showCursor ? 'opacity-100' : 'opacity-0'}`}
            />
          </div>

          {/* Main headline - massive, animated reveal */}
          <h1 
            className={`font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[0.95] tracking-tighter mb-8 transition-all duration-700 delay-200 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <span className="text-white">Put money</span>
            <br />
            <span className="text-gradient-lime">where your</span>
            <br />
            <span className="text-white">mouth is</span>
          </h1>

          {/* Description */}
          <p 
            className={`text-neutral-400 text-lg md:text-xl leading-relaxed mb-10 max-w-lg mx-auto lg:mx-0 transition-all duration-700 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            Make a promise. Stake real money. Complete it with proof — or{' '}
            <span className="text-danger-500 font-medium">lose it forever</span>. 
            Built on loss aversion: losing{' '}
            <span className="font-mono text-lime-400">$25</span>{' '}
            hurts more than gaining it feels good.
          </p>

          {/* CTA Buttons - DaisyUI glass variant */}
          <div 
            className={`flex flex-col sm:flex-row gap-4 justify-center lg:justify-start transition-all duration-700 delay-400 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <button
              onClick={() => onDownload('ios')}
              className="px-8 py-4 text-base font-semibold rounded-xl bg-lime-400 hover:bg-lime-300 text-black transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(191,255,0,0.3)] group relative overflow-hidden flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Download for iOS
            </button>
            
            <button
              onClick={() => onDownload('android')}
              className="px-8 py-4 text-base font-medium rounded-xl bg-transparent border border-neutral-600 text-white hover:border-lime-400/60 hover:bg-lime-400/5 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.34l1.612-2.791a.337.337 0 00-.124-.459.334.334 0 00-.458.124l-1.632 2.827a10.077 10.077 0 00-4.089-.861c-1.479 0-2.862.313-4.089.861l-1.632-2.827a.334.334 0 00-.458-.124.337.337 0 00-.124.459l1.612 2.791A9.652 9.652 0 003 22h18a9.652 9.652 0 00-3.477-6.66zM7 20a1 1 0 110-2 1 1 0 010 2zm10 0a1 1 0 110-2 1 1 0 010 2zM6.343 6.343A5.977 5.977 0 0112 4c2.21 0 4.21.895 5.657 2.343l1.414-1.414A7.972 7.972 0 0012 2a7.972 7.972 0 00-7.071 2.929l1.414 1.414z"/>
              </svg>
              Get for Android
            </button>
          </div>

          {/* Social proof mini */}
          <div 
            className={`mt-10 flex items-center gap-4 justify-center lg:justify-start text-sm transition-all duration-700 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="flex -space-x-2">
              {['🔥', '💪', '✨'].map((emoji, i) => (
                <div 
                  key={i}
                  className="w-8 h-8 rounded-full bg-neutral-800 border-2 border-abyss-900 flex items-center justify-center text-sm"
                >
                  {emoji}
                </div>
              ))}
            </div>
            <span className="text-neutral-500">
              <span className="text-lime-400 font-mono font-semibold">2,847</span> promises kept this week
            </span>
          </div>
        </div>

        {/* Phone mockup - positioned off-center with glow */}
        <div 
          className={`flex-shrink-0 transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-x-0 translate-y-0' : 'opacity-0 translate-x-12 translate-y-8'}`}
          style={{
            transform: isLoaded ? 'perspective(1000px) rotateY(-8deg) rotateX(2deg)' : undefined,
          }}
        >
          <div className="relative">
            {/* Extra glow behind phone */}
            <div 
              className="absolute inset-0 -z-10"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(191, 255, 0, 0.2) 0%, transparent 60%)',
                transform: 'scale(1.8)',
                filter: 'blur(50px)',
              }}
            />
            <PhoneMockup />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div 
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-all duration-700 delay-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      >
        <span className="text-neutral-600 text-xs uppercase tracking-widest">Scroll</span>
        <div className="animate-scroll-indicator">
          <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export function WebMarketingLanding() {
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleDownload = (store: 'ios' | 'android') => {
    window.open(store === 'ios' ? APP_STORE_URL : PLAY_STORE_URL, '_blank');
  };

  // Use web-specific hero on web platform
  if (Platform.OS === 'web') {
    return (
      <div className="bg-abyss-900 text-white font-sans min-h-screen overflow-x-hidden" data-theme="oopsfee">
        {/* Web-specific Hero */}
        <WebHeroSection onDownload={handleDownload} />

        {/* Social Proof Ticker */}
        <SocialProofTicker />

        {/* Problem/Solution Section - Animated Timeline & Wallet */}
        <ProblemSolutionSection />

        {/* How It Works - Animated stacking cards */}
        <HowItWorksSection />

        {/* Verification Features - 3D tilt cards with micro-animations */}
        <FeaturesGrid />

        {/* Graveyard Preview - Animated tombstones with failed promises */}
        <GraveyardPreviewSection />

        {/* Psychology/Mechanics Section */}
        <section className="relative py-24 px-6 bg-neutral-900/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-danger-500 text-xs font-mono uppercase tracking-[0.3em] mb-4 block">
                Psychology
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-white tracking-tight">
                Designed to make you{' '}
                <span className="text-gradient-danger">uncomfortable</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {MECHANICS.map((mechanic, i) => (
                <div
                  key={mechanic.title}
                  className={`p-6 rounded-2xl border transition-all duration-300 hover:scale-[1.02] ${
                    i % 2 === 1 
                      ? 'bg-transparent border-neutral-800 hover:border-neutral-700' 
                      : 'bg-neutral-800/50 border-neutral-700 hover:border-neutral-600'
                  }`}
                >
                  <h3 className="text-white text-lg font-semibold mb-3">{mechanic.title}</h3>
                  <p className="text-neutral-400 text-sm leading-relaxed">{mechanic.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section with glitch text and floating money */}
        <CTASection />

        {/* Footer */}
        <Footer />
      </div>
    );
  }

  // Native fallback (original layout)
  return (
    <View style={styles.container}>
      {/* Navigation */}
      <View style={styles.nav}>
        <Text style={styles.logo}>OopsFee</Text>
        <Pressable onPress={() => handleDownload('ios')} style={styles.navButton}>
          <Text style={styles.navButtonText}>Get the App</Text>
        </Pressable>
      </View>

      {/* Hero */}
      <View style={[styles.hero, heroVisible && styles.heroVisible]}>
        <View style={styles.heroContent}>
          <Text style={styles.tagline}>ACCOUNTABILITY APP</Text>
          <Text style={styles.heroTitle}>
            Put money where{'\n'}your mouth is
          </Text>
          <Text style={styles.heroDescription}>
            Make a promise. Stake real money. Complete it with proof — or lose
            it. Built on loss aversion psychology: losing $25 hurts more than
            gaining $25 feels good.
          </Text>

          <View style={styles.heroButtons}>
            <Pressable
              onPress={() => handleDownload('ios')}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.primaryBtnText}>Download for iOS</Text>
            </Pressable>
            <Pressable
              onPress={() => handleDownload('android')}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.secondaryBtnText}>Get for Android</Text>
            </Pressable>
          </View>
        </View>

        {/* Animated phone mockup */}
        <View style={styles.heroVisual}>
          <View style={styles.phoneMock}>
            <Text style={styles.phoneMockText}>📱</Text>
            <Text style={styles.phoneMockLabel}>$50 on the line</Text>
            <Text style={styles.phoneMockSub}>3 days left</Text>
          </View>
        </View>
      </View>

      {/* Problem/Solution */}
      <View style={styles.section}>
        <View style={styles.problemSolution}>
          <View style={styles.psCard}>
            <Text style={styles.psLabel}>THE PROBLEM</Text>
            <Text style={styles.psTitle}>
              You keep making promises to yourself and breaking them
            </Text>
            <Text style={styles.psText}>
              &ldquo;I&apos;ll start Monday.&rdquo; &ldquo;This time for
              real.&rdquo; &ldquo;New year, new me.&rdquo; Sound familiar?
              Willpower alone doesn&apos;t work. There are no consequences for
              lying to yourself.
            </Text>
          </View>
          <View style={[styles.psCard, styles.psCardSolution]}>
            <Text style={[styles.psLabel, styles.psLabelSolution]}>
              THE SOLUTION
            </Text>
            <Text style={styles.psTitle}>Make failure actually hurt</Text>
            <Text style={styles.psText}>
              When real money is on the line, you show up differently. Not
              because you&apos;re more motivated — because you can&apos;t afford
              not to.
            </Text>
          </View>
        </View>
      </View>

      {/* How it works */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
        <Text style={styles.sectionTitle}>Three steps. No loopholes.</Text>

        <View style={styles.steps}>
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Make your promise</Text>
              <Text style={styles.stepDesc}>
                Type it. Record it with your voice. Pick a deadline. Choose how
                you&apos;ll prove completion.
              </Text>
            </View>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Set your stakes</Text>
              <Text style={styles.stepDesc}>
                $5, $25, $100 — whatever makes you uncomfortable enough to
                actually follow through.
              </Text>
            </View>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Prove it or lose it</Text>
              <Text style={styles.stepDesc}>
                Complete with photo proof, friend verification, or health data.
                No proof by deadline? Money&apos;s gone.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Features */}
      <View style={[styles.section, styles.sectionDark]}>
        <Text style={styles.sectionLabel}>VERIFICATION</Text>
        <Text style={styles.sectionTitle}>No cheating. No excuses.</Text>

        <View style={styles.featureGrid}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureCard}>
              <Text style={styles.featureVisual}>{feature.visual}</Text>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Mechanics */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PSYCHOLOGY</Text>
        <Text style={styles.sectionTitle}>
          Designed to make you uncomfortable
        </Text>

        <View style={styles.mechanicsGrid}>
          {MECHANICS.map((mechanic, i) => (
            <View
              key={mechanic.title}
              style={[styles.mechanicCard, i % 2 === 1 && styles.mechanicCardAlt]}
            >
              <Text style={styles.mechanicTitle}>{mechanic.title}</Text>
              <Text style={styles.mechanicDesc}>{mechanic.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>
          Stop scrolling.{'\n'}Start committing.
        </Text>
        <Text style={styles.ctaDesc}>
          Download the app. Make one promise. Put $5 on it.{'\n'}See what
          happens when failure has a price.
        </Text>

        <View style={styles.heroButtons}>
          <Pressable
            onPress={() => handleDownload('ios')}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>Download for iOS</Text>
          </Pressable>
          <Pressable
            onPress={() => handleDownload('android')}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.secondaryBtnText}>Get for Android</Text>
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerLogo}>OopsFee</Text>
        <View style={styles.footerLinks}>
          <Text style={styles.footerLink}>Privacy</Text>
          <Text style={styles.footerLink}>Terms</Text>
          <Text style={styles.footerLink}>Support</Text>
        </View>
        <Text style={styles.footerCopy}>© 2025 OopsFee. All rights reserved.</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#09090b',
  bgElevated: '#18181b',
  bgCard: '#1f1f23',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textDim: '#71717a',
  accent: '#3b82f6',
  accentDim: 'rgba(59, 130, 246, 0.15)',
  border: '#27272a',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    overflow: 'scroll',
  },

  // Nav
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  logo: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  navButton: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  navButtonText: {
    color: COLORS.bg,
    fontSize: 14,
    fontWeight: '600',
  },

  // Hero
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 80,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    gap: 48,
    opacity: 0,
    transform: [{ translateY: 20 }],
  },
  heroVisible: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
  heroContent: {
    flex: 1,
    minWidth: 320,
  },
  tagline: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 16,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 56,
    letterSpacing: -1,
    marginBottom: 24,
  },
  heroDescription: {
    color: COLORS.textMuted,
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 32,
    maxWidth: 500,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroVisual: {
    flex: 1,
    minWidth: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneMock: {
    width: 220,
    height: 400,
    backgroundColor: COLORS.bgCard,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  phoneMockText: {
    fontSize: 64,
  },
  phoneMockLabel: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  phoneMockSub: {
    color: COLORS.textDim,
    fontSize: 16,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: COLORS.bg,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  btnPressed: {
    opacity: 0.7,
  },

  // Section
  section: {
    paddingVertical: 80,
    paddingHorizontal: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  sectionDark: {
    backgroundColor: COLORS.bgElevated,
    maxWidth: '100%',
  },
  sectionLabel: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 48,
    letterSpacing: -0.5,
  },

  // Problem/Solution
  problemSolution: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  psCard: {
    flex: 1,
    minWidth: 300,
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  psCardSolution: {
    backgroundColor: COLORS.accentDim,
    borderColor: COLORS.accent,
  },
  psLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  psLabelSolution: {
    color: COLORS.accent,
  },
  psTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 32,
  },
  psText: {
    color: COLORS.textMuted,
    fontSize: 16,
    lineHeight: 26,
  },

  // Steps
  steps: {
    maxWidth: 600,
    alignSelf: 'center',
  },
  step: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  stepDesc: {
    color: COLORS.textMuted,
    fontSize: 16,
    lineHeight: 26,
  },
  stepLine: {
    width: 2,
    height: 40,
    backgroundColor: COLORS.border,
    marginLeft: 19,
    marginVertical: 8,
  },

  // Features
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    justifyContent: 'center',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  featureCard: {
    width: 280,
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  featureVisual: {
    fontSize: 40,
    marginBottom: 16,
  },
  featureTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  featureDesc: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 24,
  },

  // Mechanics
  mechanicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    maxWidth: 900,
    alignSelf: 'center',
  },
  mechanicCard: {
    flex: 1,
    minWidth: 280,
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mechanicCardAlt: {
    backgroundColor: 'transparent',
  },
  mechanicTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  mechanicDesc: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 24,
  },

  // CTA
  ctaSection: {
    paddingVertical: 100,
    paddingHorizontal: 24,
    alignItems: 'center',
    backgroundColor: COLORS.bgElevated,
  },
  ctaTitle: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: -0.5,
    lineHeight: 48,
  },
  ctaDesc: {
    color: COLORS.textMuted,
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 40,
    maxWidth: 500,
  },

  // Footer
  footer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
    gap: 20,
  },
  footerLogo: {
    color: COLORS.textDim,
    fontSize: 18,
    fontWeight: '600',
  },
  footerLinks: {
    flexDirection: 'row',
    gap: 32,
  },
  footerLink: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  footerCopy: {
    color: COLORS.textDim,
    fontSize: 13,
  },
});
