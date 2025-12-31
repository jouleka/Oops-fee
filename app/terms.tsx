/**
 * Terms of Service Page
 * Legal document for app store submission and user transparency
 */

import { Link, type Href } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

const LAST_UPDATED = 'December 31, 2025';

export default function TermsOfServiceScreen() {
  if (Platform.OS === 'web') {
    return <WebTermsOfService />;
  }

  return <NativeTermsOfService />;
}

function WebTermsOfService() {
  return (
    <div className="h-screen bg-abyss-900 text-white overflow-y-auto">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-abyss-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold text-white hover:text-lime-400 transition-colors">
            OopsFee
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href={'/privacy' as Href} className="text-neutral-400 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <a href="mailto:support@oopsfee.app" className="text-neutral-400 hover:text-white transition-colors">
              Contact
            </a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Terms of Service
          </h1>
          <p className="text-neutral-400 text-sm">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="prose prose-invert prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              By accessing or using OopsFee (&ldquo;the App&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, you may not use the App.
            </p>
            <p className="text-neutral-300 leading-relaxed">
              These Terms constitute a legally binding agreement between you and OopsFee. Please read them carefully.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">2. Eligibility</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              To use OopsFee, you must:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into a binding agreement</li>
              <li>Not be prohibited from using the service under applicable laws</li>
              <li>Have a valid payment method for financial features</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">3. Account Registration</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              To access certain features, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mb-4 space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update any changes to your information</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
            <p className="text-neutral-300 leading-relaxed">
              We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">4. The Promise System</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              OopsFee allows you to create personal commitments (&ldquo;Promises&rdquo;) with financial stakes. By using this feature, you understand and agree:
            </p>
            
            <h3 className="text-xl font-semibold text-white mb-3">4.1 Stakes and Forfeitures</h3>
            <ul className="list-disc list-inside text-neutral-300 mb-6 space-y-2">
              <li>When you create a Promise, you stake real money from your wallet or payment method</li>
              <li>If you fail to complete the Promise by the deadline with valid verification, <strong>you forfeit the staked amount</strong></li>
              <li>Forfeited stakes are non-refundable and final</li>
              <li>We are not responsible for promises you choose to make or stakes you choose to set</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3">4.2 Verification</h3>
            <ul className="list-disc list-inside text-neutral-300 mb-6 space-y-2">
              <li>Promise completion requires verification (photo proof, partner verification, etc.)</li>
              <li>We reserve the right to reject fraudulent or invalid verification attempts</li>
              <li>Partner verification decisions are final and cannot be disputed</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3">4.3 Sponsorship and Roasts</h3>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Other users may add money to your stake (&ldquo;Sponsor&rdquo;) or submit messages (&ldquo;Roasts&rdquo;)</li>
              <li>Sponsored amounts are added to your total stake and subject to the same forfeiture rules</li>
              <li>Roast messages are only revealed if you fail the Promise</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">5. Wallet and Payments</h2>
            
            <h3 className="text-xl font-semibold text-white mb-3">5.1 Wallet Balance</h3>
            <p className="text-neutral-300 leading-relaxed mb-4">
              Your wallet balance represents funds available for use within the App. Wallet funds:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mb-6 space-y-2">
              <li>Can be used to stake Promises</li>
              <li>Can be withdrawn to your linked PayPal or bank account</li>
              <li>Do not earn interest</li>
              <li>Are subject to our Refund Policy</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3">5.2 Payment Processing</h3>
            <p className="text-neutral-300 leading-relaxed mb-4">
              All payments are processed by third-party payment processors (Stripe, PayPal). By using our payment features, you also agree to their respective terms of service.
            </p>

            <h3 className="text-xl font-semibold text-white mb-3">5.3 Fees</h3>
            <p className="text-neutral-300 leading-relaxed">
              We may charge service fees for certain transactions, including but not limited to wallet withdrawals. All applicable fees will be clearly disclosed before you complete a transaction.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">6. Prohibited Conduct</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Use the App for any illegal purpose</li>
              <li>Create fake or fraudulent verification evidence</li>
              <li>Attempt to manipulate the verification system</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Submit offensive, threatening, or inappropriate content in Roasts</li>
              <li>Create multiple accounts to circumvent restrictions</li>
              <li>Attempt to reverse engineer or hack the App</li>
              <li>Use the App for money laundering or fraudulent financial activity</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">7. Intellectual Property</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              The App, including its design, features, and content, is owned by OopsFee and protected by intellectual property laws. You may not:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Copy, modify, or distribute any part of the App</li>
              <li>Use our trademarks without permission</li>
              <li>Create derivative works based on the App</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">8. User Content</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              You retain ownership of content you submit (promises, photos, voice recordings, roasts). However, by submitting content, you grant us a worldwide, non-exclusive, royalty-free license to:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Store and process your content to provide the service</li>
              <li>Display your username and achievements on leaderboards</li>
              <li>Use anonymized, aggregated data for analytics and improvements</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">9. Disclaimer of Warranties</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              THE APP IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>The App will be uninterrupted or error-free</li>
              <li>The App will meet your specific requirements</li>
              <li>Results from using the App will be accurate or reliable</li>
              <li>Any errors in the App will be corrected</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">10. Limitation of Liability</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, OOPSFEE SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mb-4 space-y-2">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, data, or other intangible losses</li>
              <li>Damages resulting from unauthorized access to your account</li>
              <li>Damages resulting from forfeited stakes on failed Promises</li>
            </ul>
            <p className="text-neutral-300 leading-relaxed">
              Our total liability shall not exceed the amount you paid to us in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">11. Indemnification</h2>
            <p className="text-neutral-300 leading-relaxed">
              You agree to indemnify and hold harmless OopsFee, its affiliates, and their respective officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the App or violation of these Terms.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">12. Dispute Resolution</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              Any disputes arising from these Terms or your use of the App shall be resolved through:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Informal negotiation for 30 days by contacting us at the email below</li>
              <li>If negotiation fails, disputes may be resolved through mediation or arbitration</li>
              <li>You retain the right to bring claims in small claims court where applicable</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">13. Modifications to Terms</h2>
            <p className="text-neutral-300 leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms in the App and updating the &ldquo;Last updated&rdquo; date. Your continued use of the App after changes constitutes acceptance.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">14. Termination</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              We may terminate or suspend your access to the App at any time, with or without cause, with or without notice. Upon termination:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Your right to use the App ceases immediately</li>
              <li>Any pending Promises are forfeited</li>
              <li>You may withdraw available wallet balance (minus any owed amounts)</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">15. Governing Law</h2>
            <p className="text-neutral-300 leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through the dispute resolution process outlined in Section 12.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">16. Contact Us</h2>
            <p className="text-neutral-300 leading-relaxed">
              If you have any questions about these Terms, please contact us:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mt-4 space-y-2">
              <li>Email: <a href="mailto:legal@oopsfee.app" className="text-lime-400 hover:text-lime-300">legal@oopsfee.app</a></li>
              <li>Support: <a href="mailto:support@oopsfee.app" className="text-lime-400 hover:text-lime-300">support@oopsfee.app</a></li>
            </ul>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 bg-abyss-900 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
          <p>© {new Date().getFullYear()} OopsFee. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href={'/privacy' as Href} className="hover:text-white transition-colors">Privacy</Link>
            <Link href={'/terms' as Href} className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NativeTermsOfService() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By accessing or using OopsFee, you agree to be bound by these Terms of Service. If you do not agree to these Terms, you may not use the App.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Eligibility</Text>
        <Text style={styles.paragraph}>
          To use OopsFee, you must be at least 18 years of age, have the legal capacity to enter into a binding agreement, and have a valid payment method.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. The Promise System</Text>
        <Text style={styles.paragraph}>
          When you create a Promise, you stake real money. If you fail to complete the Promise by the deadline with valid verification, you forfeit the staked amount. Forfeited stakes are non-refundable and final.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Wallet and Payments</Text>
        <Text style={styles.paragraph}>
          Your wallet balance represents funds available for use within the App. All payments are processed by third-party payment processors (Stripe, PayPal).
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Prohibited Conduct</Text>
        <Text style={styles.paragraph}>
          You agree not to use the App for illegal purposes, create fraudulent verification evidence, harass other users, or attempt to manipulate the system.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          OopsFee shall not be liable for any indirect, incidental, or consequential damages, including loss of profits or damages resulting from forfeited stakes.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>7. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about these Terms, please contact us at legal@oopsfee.app.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fafafa',
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#71717a',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 26,
    color: '#a1a1aa',
  },
});

