import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchAutoApplyStatus,
  optionLabel,
  questionId,
  resolveAutoApply,
  type PendingQuestion,
} from '@/api/endpoints/autoApply';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * "Needs your input": the questions the auto-apply filler couldn't answer on
 * its own. Answer them here, hit Save, and the backend resumes the SAME
 * submission in the background with your answers — it does not re-open the form
 * or start over. Each answer is also saved to your library so the same question
 * auto-fills on the next job.
 */

/** Best-guess answer pulled from the user's profile, so questions we already
 *  know the answer to (their school) come pre-filled instead of blank. Returns
 *  '' when we have nothing — the field then renders empty as before. */
function profileDefault(q: PendingQuestion, profile: { school?: string } | null | undefined): string {
  const label = (q.label || '').toLowerCase();
  if (/school|university|college|institution|alma mater/.test(label) && profile?.school) {
    return profile.school;
  }
  return '';
}

/** Above this many options a chip wall is unusable — switch to a searchable,
 *  typeable combobox (the SpaceX "School" field ships ~hundreds of options). */
const SEARCHABLE_THRESHOLD = 10;
/** How many matches to show under the search box at once. */
const MAX_VISIBLE_MATCHES = 30;

function FieldLabel({ q }: { q: PendingQuestion }) {
  const colors = useColors();
  return (
    <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>
      {q.label}
      {q.required ? <Text style={{ color: colors.negative }}> *</Text> : null}
    </Text>
  );
}

/** A long select rendered as type-to-search with a free-text fallback: the
 *  backend often sends only the first page of a typeahead's options (e.g. the
 *  "A" universities), so the right answer may not be in the list at all. We let
 *  the user filter what's there AND submit whatever they typed. */
function SearchableSelect({
  q,
  options,
  value,
  onChange,
}: {
  q: PendingQuestion;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  const typed = value.trim();
  const lower = typed.toLowerCase();
  const exact = options.some((o) => o.toLowerCase() === lower);
  const matches = (
    typed ? options.filter((o) => o.toLowerCase().includes(lower)) : options
  ).slice(0, MAX_VISIBLE_MATCHES);

  return (
    <Card style={{ gap: 10 }}>
      <FieldLabel q={q} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="search-outline" size={16} color={colors.inkTertiary} />
        <TextInput
          value={value}
          onChangeText={(v) => {
            onChange(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type to search…"
          placeholderTextColor={colors.inkTertiary}
          style={{
            flex: 1,
            fontFamily: fonts.sans,
            fontSize: 15,
            color: colors.ink,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
      </View>

      {/* Once they've landed on an exact option we collapse the list. */}
      {open && !exact ? (
        <View style={{ gap: 2 }}>
          {matches.map((o, i) => (
            <Pressable
              key={`${o}-${i}`}
              onPress={() => {
                onChange(o);
                setOpen(false);
                Keyboard.dismiss();
              }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 8,
                backgroundColor: colors.paper2,
              }}>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>
                {o}
              </Text>
            </Pressable>
          ))}
          {typed.length > 0 && matches.length === 0 ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 12,
                color: colors.inkTertiary,
                paddingHorizontal: 4,
                paddingTop: 2,
                lineHeight: 17,
              }}>
              Not in the list — we’ll use “{typed}”.
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function QuestionField({
  q,
  value,
  onChange,
}: {
  q: PendingQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  const options = (q.options ?? []).map(optionLabel).filter(Boolean);
  const isSelect = (q.field_type === 'select' || options.length > 0) && options.length > 0;

  if (isSelect && options.length > SEARCHABLE_THRESHOLD) {
    return <SearchableSelect q={q} options={options} value={value} onChange={onChange} />;
  }

  return (
    <Card style={{ gap: 10 }}>
      <FieldLabel q={q} />

      {isSelect ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map((label, i) => {
            const selected = value === label;
            return (
              <Pressable
                key={`${label}-${i}`}
                onPress={() => onChange(label)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected ? colors.accent : colors.hairline,
                  backgroundColor: selected ? colors.accent + '12' : colors.paper,
                }}>
                <Text
                  style={{
                    fontFamily: fonts.sansMedium,
                    fontSize: 13,
                    color: selected ? colors.accent : colors.ink,
                  }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Your answer"
          placeholderTextColor={colors.inkTertiary}
          multiline={q.field_type === 'textarea'}
          style={{
            fontFamily: fonts.sans,
            fontSize: 15,
            color: colors.ink,
            borderWidth: 1,
            borderColor: colors.hairline,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: q.field_type === 'textarea' ? 80 : undefined,
            textAlignVertical: q.field_type === 'textarea' ? 'top' : 'center',
          }}
        />
      )}
    </Card>
  );
}

export default function ApplyQuestionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const qc = useQueryClient();
  const { showToast, profile } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['autoApplyStatus', id],
    queryFn: () => fetchAutoApplyStatus(String(id)),
    enabled: !!id,
  });

  const pending = data?.pending_questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Seed answers we already know from the profile (e.g. a "School / University"
  // dropdown — it's on the profile, the user shouldn't have to hunt for it). One
  // pass per question, never clobbering anything the user has touched.
  useEffect(() => {
    if (!pending.length) return;
    setAnswers((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const q of pending) {
        const qid = questionId(q);
        if (next[qid] != null) continue;
        const guess = profileDefault(q, profile);
        if (guess) {
          next[qid] = guess;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pending, profile]);

  const requiredAnswered = pending
    .filter((q) => q.required)
    .every((q) => (answers[questionId(q)] ?? '').trim().length > 0);

  const save = useMutation({
    mutationFn: () => {
      // Only send answered questions.
      const filled: Record<string, string> = {};
      for (const q of pending) {
        const qid = questionId(q);
        const v = (answers[qid] ?? '').trim();
        if (v) filled[qid] = v;
      }
      return resolveAutoApply(String(id), filled);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['appliedJobs'] });
      qc.invalidateQueries({ queryKey: ['autoApplyStatus', id] });
      if (res.status === 'needs_attention') {
        showToast('Saved — a few required questions still need an answer');
      } else {
        showToast('Saved — finishing your application in the background');
        router.back();
      }
    },
    onError: () => showToast('Could not save your answers, try again'),
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
          backgroundColor: colors.paper,
          borderBottomWidth: 1,
          borderBottomColor: colors.hairline,
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.heading }}>
            Needs your input
          </Text>
          {data?.company ? (
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.inkSecondary }}>
              {data.job_title} · {data.company}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : pending.length === 0 ? (
        (() => {
          // No pending questions — say what's actually going on based on status,
          // so a mid-resume doesn't read as a confusing "nothing to answer".
          const s = data?.status;
          const meta =
            s === 'submitted'
              ? { icon: 'checkmark-circle' as const, tone: colors.positive, msg: 'Submitted — you’re all set.' }
              : s === 'needs_verification'
                ? { icon: 'mail-unread-outline' as const, tone: colors.waiting, msg: 'The employer emailed a code — we’re completing the verification.' }
                : s === 'failed' || s === 'submit_failed'
                  ? { icon: 'close-circle-outline' as const, tone: colors.negative, msg: 'This application didn’t go through. Your credits were refunded.' }
                  : { icon: 'sync-outline' as const, tone: colors.accent, msg: 'Finishing your application in the background — check back in a moment.' };
          return (
            <View style={{ padding: 24, alignItems: 'center', gap: 12 }}>
              <Ionicons name={meta.icon} size={40} color={meta.tone} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, textAlign: 'center', lineHeight: 21 }}>
                {meta.msg}
              </Text>
              <Button label="Done" onPress={() => router.back()} />
            </View>
          );
        })()
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: insets.bottom + 40 }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary, lineHeight: 20 }}>
            The auto-apply ran into {pending.length} question{pending.length === 1 ? '' : 's'} it
            couldn’t answer for you. Fill these in and we’ll finish submitting in the background —
            no need to redo the rest.
          </Text>

          {pending.map((q) => {
            const qid = questionId(q);
            return (
              <QuestionField
                key={qid}
                q={q}
                value={answers[qid] ?? ''}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [qid]: v }))}
              />
            );
          })}

          <Button
            label={save.isPending ? 'Saving…' : 'Save & finish applying'}
            onPress={() => save.mutate()}
            disabled={!requiredAnswered || save.isPending}
          />
          {!requiredAnswered ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary, textAlign: 'center' }}>
              Answer the required questions (*) to finish.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
