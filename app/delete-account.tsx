/**
 * Delete Account Page
 * Provides account deletion instructions as required by Google Play
 * Consistent with Privacy Policy and Terms of Service
 */

import { Link, type Href } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View, Pressable, Linking } from 'react-native';

const LAST_UPDATED = 'December 31, 2025';
const SUPPORT_EMAIL = 'privacy@oopsfee.app';

export default function DeleteAccountScreen() {
  if (Platform.OS === 'web') {
    return <WebDeleteAccount />;
  }

  return <NativeDeleteAccount />;
}

function WebDeleteAccount() {
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
            <Link href={'/terms' as Href} className="text-neutral-400 hover:text-white transition-colors">
              Terms of Service
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Delete Your Account
          </h1>
          <p className="text-neutral-400 text-sm">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="prose prose-invert prose-lg max-w-none">
          {/* Important Notice */}
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 mb-12">
            <h2 className="text-xl font-bold text-red-400 mb-3 mt-0">⚠️ Important: Before You Delete</h2>
            <ul className="list-disc list-inside text-neutral-300 space-y-2 mb-0">
              <li><strong>Active Promises:</strong> Will be cancelled automatically (you won&apos;t be charged)</li>
              <li><strong>Wallet Balance:</strong> Must be withdrawn before deletion (required)</li>
              <li><strong>This action is permanent</strong> and cannot be undone</li>
            </ul>
          </div>

          {/* How to Delete */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">How to Delete Your Account</h2>
            
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-semibold text-lime-400 mb-4">Option 1: In-App Deletion (Recommended)</h3>
              <ol className="list-decimal list-inside text-neutral-300 space-y-3">
                <li>Open the OopsFee app</li>
                <li>Go to <strong>Profile</strong> (tap your avatar or the profile icon)</li>
                <li>Scroll to the bottom of the screen</li>
                <li>Tap <strong>&ldquo;Delete Account&rdquo;</strong> (in red text)</li>
                <li>Confirm your decision twice when prompted</li>
              </ol>
              <p className="text-neutral-400 text-sm mt-4">
                Note: If you have a wallet balance, you must withdraw it first before deletion is allowed.
              </p>
            </div>

            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-lime-400 mb-4">Option 2: Email Request</h3>
              <p className="text-neutral-300 mb-4">
                If you cannot access the app, send an email to request account deletion:
              </p>
              <ol className="list-decimal list-inside text-neutral-300 space-y-3 mb-4">
                <li>Send an email to <a href={`mailto:${SUPPORT_EMAIL}?subject=Account%20Deletion%20Request`} className="text-lime-400 hover:text-lime-300 font-semibold">{SUPPORT_EMAIL}</a></li>
                <li>Use the subject line: <strong>&ldquo;Account Deletion Request&rdquo;</strong></li>
                <li>Include the email address associated with your OopsFee account</li>
                <li>We will verify your identity and process your request within <strong>30 days</strong></li>
              </ol>
              <a 
                href={`mailto:${SUPPORT_EMAIL}?subject=Account%20Deletion%20Request&body=I%20would%20like%20to%20request%20the%20deletion%20of%20my%20OopsFee%20account.%0A%0AAccount%20email%3A%20%5BYour%20email%20here%5D%0A%0APlease%20confirm%20when%20my%20account%20and%20data%20have%20been%20deleted.`}
                className="inline-block bg-lime-500 hover:bg-lime-400 text-black font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                Request Deletion via Email
              </a>
            </div>
          </section>

          {/* What Gets Deleted */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">What Data Gets Deleted</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              When you delete your account, the following data is <strong>permanently removed</strong>:
            </p>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li>Your profile information (name, email, username, avatar)</li>
              <li>Your promise history and check-in data</li>
              <li>Voice recordings and photo verifications</li>
              <li>Friend connections and pending friend requests</li>
              <li>Push notification tokens and device identifiers</li>
              <li>Wallet balance (must be withdrawn first)</li>
              <li>Saved payment methods</li>
            </ul>
          </section>

          {/* What We Retain */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">What Data We Retain</h2>
            <p className="text-neutral-300 leading-relaxed mb-4">
              As stated in our <Link href={'/privacy' as Href} className="text-lime-400 hover:text-lime-300">Privacy Policy</Link>, we retain certain data for legal and regulatory compliance:
            </p>
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-neutral-700/50">
                  <tr>
                    <th className="px-4 py-3 text-white font-semibold">Data Type</th>
                    <th className="px-4 py-3 text-white font-semibold">Retention Period</th>
                    <th className="px-4 py-3 text-white font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-300">
                  <tr className="border-t border-neutral-700">
                    <td className="px-4 py-3">Financial transaction records</td>
                    <td className="px-4 py-3">7 years</td>
                    <td className="px-4 py-3">Tax and legal compliance</td>
                  </tr>
                  <tr className="border-t border-neutral-700">
                    <td className="px-4 py-3">Payment processor records</td>
                    <td className="px-4 py-3">Per Stripe/PayPal policies</td>
                    <td className="px-4 py-3">Fraud prevention</td>
                  </tr>
                  <tr className="border-t border-neutral-700">
                    <td className="px-4 py-3">Anonymized usage statistics</td>
                    <td className="px-4 py-3">Indefinitely</td>
                    <td className="px-4 py-3">Service improvement</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-neutral-400 text-sm mt-4">
              Retained data is anonymized where possible and cannot be used to identify you personally.
            </p>
          </section>

          {/* Timeline */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Deletion Timeline</h2>
            <ul className="list-disc list-inside text-neutral-300 space-y-2">
              <li><strong>Immediate:</strong> Your account is deactivated and you are logged out</li>
              <li><strong>Within 24 hours:</strong> Your profile is no longer visible to other users</li>
              <li><strong>Within 30 days:</strong> All personal data is permanently deleted from our systems</li>
              <li><strong>Exception:</strong> Data retained for legal compliance (see above)</li>
            </ul>
          </section>

          {/* Contact */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Questions?</h2>
            <p className="text-neutral-300 leading-relaxed">
              If you have any questions about account deletion or data privacy, please contact us:
            </p>
            <ul className="list-disc list-inside text-neutral-300 mt-4 space-y-2">
              <li>Privacy inquiries: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-lime-400 hover:text-lime-300">{SUPPORT_EMAIL}</a></li>
              <li>General support: <a href="mailto:support@oopsfee.app" className="text-lime-400 hover:text-lime-300">support@oopsfee.app</a></li>
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

function NativeDeleteAccount() {
  const handleEmailRequest = () => {
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=Account%20Deletion%20Request&body=I%20would%20like%20to%20request%20the%20deletion%20of%20my%20OopsFee%20account.%0A%0AAccount%20email%3A%20%5BYour%20email%20here%5D%0A%0APlease%20confirm%20when%20my%20account%20and%20data%20have%20been%20deleted.`
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Delete Your Account</Text>
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>
      </View>

      {/* Warning Box */}
      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>⚠️ Before You Delete</Text>
        <Text style={styles.warningText}>
          • Active promises will be cancelled (no charge){'\n'}
          • Wallet balance must be withdrawn first{'\n'}
          • This action is permanent and cannot be undone
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How to Delete Your Account</Text>
        
        <View style={styles.optionBox}>
          <Text style={styles.optionTitle}>Option 1: In-App Deletion</Text>
          <Text style={styles.paragraph}>
            1. Go to Profile{'\n'}
            2. Scroll to the bottom of the screen{'\n'}
            3. Tap Delete Account (in red){'\n'}
            4. Confirm your decision twice{'\n'}
            {'\n'}
            Note: Withdraw wallet balance first if you have funds.
          </Text>
        </View>

        <View style={styles.optionBox}>
          <Text style={styles.optionTitle}>Option 2: Email Request</Text>
          <Text style={styles.paragraph}>
            Send an email to {SUPPORT_EMAIL} with subject Account Deletion Request and include your account email address.
          </Text>
          <Pressable style={styles.button} onPress={handleEmailRequest}>
            <Text style={styles.buttonText}>Request via Email</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What Gets Deleted</Text>
        <Text style={styles.paragraph}>
          • Profile information (name, email, username){'\n'}
          • Promise history and check-in data{'\n'}
          • Voice recordings and photos{'\n'}
          • Friend connections{'\n'}
          • Wallet balance and payment methods
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What We Retain</Text>
        <Text style={styles.paragraph}>
          For legal compliance, we retain:{'\n'}
          • Financial transaction records (7 years){'\n'}
          • Payment processor records (per their policies){'\n'}
          • Anonymized usage statistics
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Deletion Timeline</Text>
        <Text style={styles.paragraph}>
          • Immediate: Account deactivated{'\n'}
          • Within 24 hours: Profile hidden{'\n'}
          • Within 30 days: All data deleted
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Questions?</Text>
        <Text style={styles.paragraph}>
          Contact us at {SUPPORT_EMAIL} for privacy inquiries or support@oopsfee.app for general support.
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
    marginBottom: 24,
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
  warningBox: {
    backgroundColor: 'rgba(127, 29, 29, 0.3)',
    borderWidth: 1,
    borderColor: '#991b1b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f87171',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#d4d4d8',
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
  optionBox: {
    backgroundColor: 'rgba(38, 38, 38, 0.5)',
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a3e635',
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 26,
    color: '#a1a1aa',
  },
  button: {
    backgroundColor: '#a3e635',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});

