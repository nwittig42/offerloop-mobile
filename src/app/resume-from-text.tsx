import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  finalizeResume,
  generateResumeFromPrompt,
  sectionsFromCanonical,
  type CanonicalResume,
} from '@/api/endpoints/resumeBuilder';
import { qk } from '@/api/queryKeys';
import { ResumePreview } from '@/components/resume/ResumePreview';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The third door: no resume file, thin or no LinkedIn. The user describes
 * (or pastes, or dictates with the keyboard mic) whatever they have, and the
 * website's Harvard-format builder drafts from it. Same rule as every
 * generated resume: previewed and approved before anything uses it.
 */
export default function ResumeFromTextScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useApp();

  const [text, setText] = useState('');
  const [state, setState] = useState<
    | { phase: 'input' }
    | { phase: 'loading' }
    | { phase: 'ready'; resume: CanonicalResume }
    | { phase: 'limit' }
    | { phase: 'error'; message: string }
  >({ phase: 'input' });
  const [adopting, setAdopting] = useState(false);

  const generate = async () => {
    const prompt = text.trim();
    if (prompt.length < 30) {
      showToast('A little more detail helps: jobs, school, clubs, anything.');
      return;
    }
    setState({ phase: 'loading' });
    const r = await generateResumeFromPrompt(prompt);
    if (r.status === 'ok') setState({ phase: 'ready', resume: r.resume });
    else if (r.status === 'limit') setState({ phase: 'limit' });
    else setState({ phase: 'error', message: r.status === 'error' ? r.message : 'Something went wrong.' });
  };

  const adopt = async () => {
    if (state.phase !== 'ready' || adopting) return;
    setAdopting(true);
    const ok = await finalizeResume(state.resume);
    setAdopting(false);
    if (ok) {
      showToast('Resume saved. Auto-apply can use it now.');
      await queryClient.invalidateQueries({ queryKey: qk.me });
      await queryClient.invalidateQueries({ queryKey: ['applicationProfile'] });
      router.back();
    } else {
      showToast('Could not save the resume. Try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.heading, flex: 1 }}>
          Tell Scout what you have done
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      {state.phase === 'input' ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}>
          <ScrollView
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image
                source={require('../../assets/images/scout-yeti-head.png')}
                style={{ width: 44, height: 44 }}
                resizeMode="contain"
                accessibilityLabel="Scout"
              />
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.sans,
                  fontSize: 13.5,
                  color: colors.inkSecondary,
                  lineHeight: 20,
                }}>
                In your own words: jobs, internships, school, clubs, projects, anything.
                Paste an old resume, a bio, or just talk it out with the keyboard mic.
              </Text>
            </View>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder="Example: I'm a junior at UCLA studying economics. Last summer I interned at a small marketing agency where I ran their social accounts. I also tutor high schoolers in math and I'm treasurer of the sailing club..."
              placeholderTextColor={colors.inkTertiary}
              textAlignVertical="top"
              style={{
                minHeight: 220,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: colors.hairline,
                backgroundColor: colors.paper,
                padding: 14,
                fontFamily: fonts.sans,
                fontSize: 14.5,
                lineHeight: 21,
                color: colors.ink,
              }}
            />
            <Button label="Build my resume" variant="brand" fullWidth onPress={() => void generate()} />
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 11.5,
                color: colors.inkTertiary,
                textAlign: 'center',
                lineHeight: 16,
              }}>
              Scout only works with what you give him, nothing gets invented. You review
              the draft before anything uses it.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1, padding: 20, paddingBottom: insets.bottom + 16 }}>
          {state.phase === 'loading' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <ActivityIndicator color={colors.navy} />
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.inkSecondary }}>
                Scout is drafting your resume…
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkTertiary }}>
                This can take up to a minute.
              </Text>
            </View>
          ) : state.phase === 'ready' ? (
            <ResumePreview
              fileName="Offerloop_Resume.pdf"
              sections={sectionsFromCanonical(state.resume)}
              onUse={adopt}
              busy={adopting}
              onSecondary={() => setState({ phase: 'input' })}
              secondaryLabel="Edit my description"
            />
          ) : state.phase === 'limit' ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="hourglass-outline" size={34} color={colors.inkTertiary} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, textAlign: 'center', lineHeight: 20 }}>
                You have reached the resume generation limit for now.
              </Text>
              <Button label="Close" variant="outline" onPress={() => router.back()} />
            </View>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Ionicons name="cloud-offline-outline" size={34} color={colors.inkTertiary} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, textAlign: 'center' }}>
                {state.phase === 'error' ? state.message : 'Something went wrong.'}
              </Text>
              <Button label="Try again" variant="outline" onPress={() => setState({ phase: 'input' })} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
