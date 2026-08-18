import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { refineResume, type CanonicalResume } from '@/api/endpoints/resumeBuilder';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * "Describe your changes": the edit loop for a generated resume (Rylan
 * 2026-08-11, after his build came back with unknown timeframes). The user
 * types what to fix in plain words ("my internship at X was summer 2025",
 * "cut the third bullet"), the backend applies it to the current draft and
 * only changes what was asked. Collapsed to one quiet row until tapped.
 */
export function ResumeRefine({
  resume,
  onRefined,
  onLimit,
  onError,
}: {
  resume: CanonicalResume;
  onRefined: (next: CanonicalResume) => void;
  onLimit: () => void;
  onError: (message: string) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setBusy(true);
    const r = await refineResume(prompt, resume);
    setBusy(false);
    if (r.status === 'ok') {
      setText('');
      setOpen(false);
      onRefined(r.resume);
    } else if (r.status === 'limit') {
      onLimit();
    } else {
      onError(r.status === 'error' ? r.message : 'Could not apply that change.');
    }
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          borderWidth: 1,
          borderColor: colors.accent,
          borderRadius: 8,
          paddingVertical: 11,
          opacity: 1,
        }}>
        <Ionicons name="create-outline" size={16} color={colors.accent} />
        <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.accent }}>
          Describe your changes
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        placeholder='Say what to fix, like "my Acme internship was June to August 2025" or "shorten the second bullet".'
        placeholderTextColor={colors.inkTertiary}
        textAlignVertical="top"
        style={{
          minHeight: 74,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: colors.hairline,
          backgroundColor: colors.paper,
          padding: 12,
          fontFamily: fonts.sans,
          fontSize: 14,
          lineHeight: 20,
          color: colors.ink,
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => {
            setOpen(false);
            setText('');
          }}
          disabled={busy}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: 11,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.hairline,
            opacity: 1,
          }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.inkSecondary }}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void apply()}
          disabled={busy || !text.trim()}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            paddingVertical: 11,
            borderRadius: 8,
            backgroundColor: colors.ink,
            opacity: busy || !text.trim() ? 0.6 : 1,
          }}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.paper} />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={15} color={colors.paper} />
          )}
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.paper }}>
            {busy ? 'Applying…' : 'Apply changes'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default ResumeRefine;
