/**
 * Web Marketing Landing Page
 * Showcasing actual app features with clean, engaging design
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { APP_STORE_URL, PLAY_STORE_URL } from '@/constants/app-stores';

// ─────────────────────────────────────────────────────────────
// FEATURE DATA
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
      'Assign a friend as your witness. They confirm you did it — or they don&apos;t. Their call.',
    visual: '👥',
  },
  {
    title: 'The Graveyard',
    description:
      'Every broken promise gets a tombstone. How long it lasted. How much you lost. Forever.',
    visual: '🪦',
  },
];

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

        {/* Phone mockup placeholder */}
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
