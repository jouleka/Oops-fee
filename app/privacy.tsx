/**
 * Privacy Policy Page
 * Legal document for app store submission and user transparency
 */

import { Link, type Href } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

const LAST_UPDATED = 'December 31, 2025';

export default function PrivacyPolicyScreen() {
  if (Platform.OS === 'web') {
    return <WebPrivacyPolicy />;
  }

  return <NativePrivacyPolicy />;
}

function WebPrivacyPolicy() {
  return (
    <div className="h-screen bg-abyss-900 text-white overflow-y-auto">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-abyss-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold text-white hover:text-lime-400 transition-colors">
            OopsFee
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href={'/terms' as Href} className="text-neutral-400 hover:text-white transition-colors">
              Terms of Service
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
            Privacy Policy
          </h1>
          <p className="text-neutral-400 text-sm">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="prose prose-invert prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              Welcome to OopsFee (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services.
            </p>
            <p className="text-neutral-300 leading-relaxed">
              By using OopsFee, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-white mb-3">Personal Information</h3>
            <p className="text-neutral-300 leading-relaxed mb-4">
              When you create an account, we collect:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mb-6 space-y-2">
              <li>Email address</li>
              <li>Display name/username</li>
              <li>Profile picture (optional)</li>
              <li>Phone number (for OTP authentication, optional)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3">Financial Information</h3>
            <p className="text-neutral-300 leading-relaxed mb-4">
              To process payments and payouts, we use Stripe and PayPal. We do not store your complete payment card details. Our payment processors collect:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mb-6 space-y-2">
              <li>Payment card information (processed securely by Stripe)</li>
              <li>Billing address</li>
              <li>PayPal account information (if you choose PayPal)</li>
              <li>Transaction history within the app</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3">Promise & Activity Data</h3>
            <p className="text-neutral-300 leading-relaxed mb-4">
              To provide our core service, we collect:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mb-6 space-y-2">
              <li>Promises you create (text, deadlines, stake amounts)</li>
              <li>Voice recordings for voice commitment feature</li>
              <li>Photos for verification purposes</li>
              <li>Check-in data and completion status</li>
              <li>Friend connections and partner verification data</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3">Device & Usage Information</h3>
            <p className="text-neutral-300 leading-relaxed mb-4">
              We automatically collect:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Device type and operating system</li>
              <li>App version</li>
              <li>Push notification tokens</li>
              <li>General usage analytics (non-personally identifiable)</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process financial transactions (stakes, payouts, refunds)</li>
              <li>Send push notifications (reminders, check-ins, verification requests)</li>
              <li>Enable social features (friend connections, partner verification, sponsoring)</li>
              <li>Display leaderboards and statistics</li>
              <li>Communicate with you about updates and support</li>
              <li>Detect and prevent fraud or abuse</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">4. How We Share Your Information</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mb-6 space-y-2">
              <li><strong>Service Providers:</strong> Stripe and PayPal for payment processing; Supabase for data storage; Expo for app distribution</li>
              <li><strong>Other Users:</strong> Username and profile picture visible to friends; promise completion status shared with verification partners</li>
              <li><strong>Legal Requirements:</strong> When required by law, subpoena, or government request</li>
            </ul>
            <p className="text-neutral-300 leading-relaxed">
              We never share your financial details, voice recordings, or private promise content with third parties for marketing purposes.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">5. Data Storage & Security</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              Your data is stored securely using industry-standard practices:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>All data is encrypted in transit using TLS 1.3</li>
              <li>Data at rest is encrypted using AES-256</li>
              <li>Authentication handled via OAuth 2.0 (Apple Sign-In, Google Sign-In) or secure OTP</li>
              <li>Payment data is handled directly by PCI-compliant processors (Stripe, PayPal)</li>
              <li>We use Row Level Security (RLS) to ensure users can only access their own data</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">6. Your Rights & Choices</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mb-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Delete:</strong> Request deletion of your account and associated data</li>
              <li><strong>Correct:</strong> Update inaccurate personal information</li>
              <li><strong>Opt-out:</strong> Disable push notifications in your device settings</li>
              <li><strong>Withdraw consent:</strong> Revoke access permissions at any time</li>
            </ul>
            <p className="text-neutral-300 leading-relaxed">
              To exercise these rights, contact us at <a href="mailto:privacy@oopsfee.app" className="text-lime-400 hover:text-lime-300">privacy@oopsfee.app</a>.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">7. Data Retention</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              We retain your data as follows:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Account data: Until you delete your account</li>
              <li>Promise data: Indefinitely (to maintain the Graveyard feature and statistics)</li>
              <li>Voice recordings: 30 days after promise completion or failure</li>
              <li>Financial records: 7 years for legal and tax compliance</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">8. Children&apos;s Privacy</h2>
            <p className="text-neutral-300 leading-relaxed">
              OopsFee is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">9. International Users</h2>
            <p className="text-neutral-300 leading-relaxed">
              Our services are hosted in the United States. If you access OopsFee from outside the US, please be aware that your information may be transferred to, stored, and processed in the US where our servers are located. By using our service, you consent to this transfer.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to This Policy</h2>
            <p className="text-neutral-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &ldquo;Last updated&rdquo; date. Continued use of the app after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact Us</h2>
            <p className="text-neutral-300 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mt-4 space-y-2">
              <li>Email: <a href="mailto:privacy@oopsfee.app" className="text-lime-400 hover:text-lime-300">privacy@oopsfee.app</a></li>
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

function NativePrivacyPolicy() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          Welcome to OopsFee. We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        <Text style={styles.subTitle}>Personal Information</Text>
        <Text style={styles.paragraph}>
          When you create an account, we collect: email address, display name/username, profile picture (optional), and phone number (for OTP authentication, optional).
        </Text>
        <Text style={styles.subTitle}>Financial Information</Text>
        <Text style={styles.paragraph}>
          To process payments and payouts, we use Stripe and PayPal. We do not store your complete payment card details.
        </Text>
        <Text style={styles.subTitle}>Promise & Activity Data</Text>
        <Text style={styles.paragraph}>
          To provide our core service, we collect: promises you create, voice recordings, photos for verification, check-in data, and friend connections.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use the information we collect to provide, maintain, and improve our services; process financial transactions; send push notifications; enable social features; and comply with legal obligations.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Data Security</Text>
        <Text style={styles.paragraph}>
          Your data is stored securely using industry-standard practices including TLS 1.3 encryption in transit, AES-256 encryption at rest, and Row Level Security policies.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Your Rights</Text>
        <Text style={styles.paragraph}>
          You have the right to access, delete, and correct your personal data. To exercise these rights, contact us at privacy@oopsfee.app.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>6. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about this Privacy Policy, please contact us at privacy@oopsfee.app.
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
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a1a1aa',
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 26,
    color: '#a1a1aa',
  },
});

