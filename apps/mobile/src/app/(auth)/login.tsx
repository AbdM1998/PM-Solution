import { useState } from 'react';
import { Link } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { ApiError } from '@projectflow/shared';

import { AnimatedIcon } from '@/components/animated-icon';
import { FormInput } from '@/components/form-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.container}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.heading}>
            ProjectFlow
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subheading}>
            Sign in to see what's due today.
          </ThemedText>

          <ThemedView type="card" style={styles.form}>
            <FormInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@example.com"
            />
            <FormInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              error={error}
            />
            <PrimaryButton title="Log in" onPress={handleSubmit} loading={loading} />
          </ThemedView>

          <Link href="/(auth)/register" style={styles.link}>
            <ThemedText type="link" themeColor="primary">
              Don't have an account? Create one
            </ThemedText>
          </Link>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function describeAuthError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Incorrect email or password.';
    if (err.status === 409) return 'An account with that email already exists.';
    return err.message || 'Something went wrong. Please try again.';
  }
  return 'The server is unreachable. Check your connection and try again.';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  container: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
  },
  heading: { fontSize: 32, lineHeight: 38 },
  subheading: { textAlign: 'center' },
  form: {
    width: '100%',
    maxWidth: 360,
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  link: { marginTop: Spacing.two },
});
