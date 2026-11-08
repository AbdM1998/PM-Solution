import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import type { SnoozeOption } from '@projectflow/shared';

import { FormInput } from '@/components/form-input';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PRESETS: { option: SnoozeOption; label: string; confirmLabel: string }[] = [
  { option: '5m', label: '5 minutes', confirmLabel: 'in 5 minutes' },
  { option: '10m', label: '10 minutes', confirmLabel: 'in 10 minutes' },
  { option: '30m', label: '30 minutes', confirmLabel: 'in 30 minutes' },
  { option: '1h', label: '1 hour', confirmLabel: 'in 1 hour' },
  { option: 'later_today', label: 'Later today', confirmLabel: 'later today' },
  { option: 'tomorrow', label: 'Tomorrow', confirmLabel: 'tomorrow' },
  { option: 'next_week', label: 'Next week', confirmLabel: 'next week' },
];

/**
 * Custom date/time is entered as plain text fields (YYYY-MM-DD / HH:MM), not a native
 * `@react-native-community/datetimepicker`. That picker is Android/iOS-only (no web
 * support) and this sandbox has no device/emulator to interactively verify its
 * behavior — text inputs are fully testable here and on every platform. Swapping in a
 * native picker is a reasonable follow-up once real device testing is possible.
 */
export function SnoozeSheet({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (option: SnoozeOption, customAt: string | undefined, confirmLabel: string) => void;
}) {
  const theme = useTheme();
  const [customMode, setCustomMode] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCustomMode(false);
    setDate('');
    setTime('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handlePreset(option: SnoozeOption, confirmLabel: string) {
    onConfirm(option, undefined, confirmLabel);
    reset();
  }

  function handleCustomConfirm() {
    const match = /^\d{4}-\d{2}-\d{2}$/.test(date.trim());
    const timeMatch = /^\d{2}:\d{2}$/.test(time.trim());
    if (!match || !timeMatch) {
      setError('Enter a date as YYYY-MM-DD and a time as HH:MM (24h).');
      return;
    }
    const iso = new Date(`${date.trim()}T${time.trim()}:00`);
    if (Number.isNaN(iso.getTime())) {
      setError('That date/time is not valid.');
      return;
    }
    if (iso.getTime() <= Date.now()) {
      setError('Pick a time in the future.');
      return;
    }
    onConfirm('custom', iso.toISOString(), 'at the time you chose');
    reset();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheetContainer}>
        <ThemedView type="card" style={[styles.sheet, { borderColor: theme.border }]}>
          <ThemedText type="smallBold" style={styles.title}>
            Snooze reminder
          </ThemedText>

          {!customMode ? (
            <>
              <View style={styles.grid}>
                {PRESETS.map((preset) => (
                  <Pressable
                    key={preset.option}
                    onPress={() => handlePreset(preset.option, preset.confirmLabel)}
                    style={({ pressed }) => [
                      styles.presetButton,
                      { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <ThemedText type="small">{preset.label}</ThemedText>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => setCustomMode(true)} style={styles.customLink}>
                <ThemedText type="link" themeColor="primary">
                  Custom date &amp; time…
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <View style={styles.customForm}>
              <FormInput label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-11-10" error={error} />
              <FormInput label="Time, 24h (HH:MM)" value={time} onChangeText={setTime} placeholder="18:00" />
              <PrimaryButton title="Snooze to this time" onPress={handleCustomConfirm} />
              <Pressable onPress={() => setCustomMode(false)} style={styles.customLink}>
                <ThemedText type="link" themeColor="textSecondary">
                  Back to presets
                </ThemedText>
              </Pressable>
            </View>
          )}

          <Pressable onPress={handleClose} style={styles.cancelButton}>
            <ThemedText type="small" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  presetButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    minWidth: '30%',
    alignItems: 'center',
  },
  customLink: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  customForm: {
    gap: Spacing.two,
  },
  cancelButton: {
    alignItems: 'center',
    paddingTop: Spacing.one,
  },
});
