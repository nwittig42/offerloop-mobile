import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  const options = q.options ?? [];
  const isSelect = (q.field_type === 'select' || options.length > 0) && options.length > 0;

  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>
        {q.label}
        {q.required ? <Text style={{ color: colors.negative }}> *</Text> : null}
      </Text>

      {isSelect ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map((o, i) => {
            const label = optionLabel(o);
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
  const { showToast } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['autoApplyStatus', id],
    queryFn: () => fetchAutoApplyStatus(String(id)),
    enabled: !!id,
  });

  const pending = data?.pending_questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});

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
          paddingTop: 18,
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
        <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
          <Ionicons name="checkmark-circle-outline" size={40} color={colors.positive} />
          <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, textAlign: 'center' }}>
            Nothing left to answer — this application is back in progress.
          </Text>
          <Button label="Done" onPress={() => router.back()} />
        </View>
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
