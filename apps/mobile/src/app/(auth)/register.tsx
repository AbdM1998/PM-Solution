import { useState } from 'react';
import { Link } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { FormInput } from '@/components/form-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

import { describeAuthError } from './login';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError('Name, email, and an 8+ character password are required.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
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
          <ThemedText type="title" style={styles.heading}>
            Create account
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subheading}>
            Track your projects, tasks, and reminders in one place.
          </ThemedText>

          <ThemedView type="card" style={styles.form}>
            <FormInput label="Name" value={name} onChangeText={setName} autoComplete="name" placeholder="Jane Doe" />
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
              autoComplete="password-new"
              placeholder="At least 8 characters"
              error={error}
            />
            <PrimaryButton title="Create account" onPress={handleSubmit} loading={loading} />
          </ThemedView>

          <Link href="/(auth)/login" style={styles.link} replace>
            <ThemedText type="link" themeColor="primary">
              Already have an account? Log in
            </ThemedText>
          </Link>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
  heading: { fontSize: 28, lineHeight: 34 },
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
