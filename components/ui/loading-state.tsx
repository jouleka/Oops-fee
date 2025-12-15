import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Typography } from '@/constants/theme';

export function LoadingState({
  title = 'Loading…',
  subtitle = 'Fetching your consequences.',
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.accent} />
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.bg,
    gap: Spacing.lg,
  },
  textBlock: { alignItems: 'center', gap: 6 },
  title: { ...Typography.h2, color: Colors.text, fontFamily: Fonts.rounded, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.textTertiary, textAlign: 'center' },
});


