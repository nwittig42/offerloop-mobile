import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import {
  prepareAutoApply,
  submitAutoApply,
  type PrepareResult,
} from '@/api/endpoints/autoApply';
import { Button } from '@/components/ui/Button';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import type { Job } from '@/types';

/**
 * Review-first auto-apply. Slides up when a user swipes an eligible job with
 * auto-apply on. Calls prepare to show the filled application, then a single
 * Submit fires the real Browserbase submission. Nothing is sent without the
 * tap — the user always sees what's going out first (the Simplify/Jobright
 * model, not silent spray). Skip backs out with only the draft having happened.
 */

function Row({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
      <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkTertiary }}>{label}</Text>
      <Text
        numberOfLines={1}
        style={{ flex: 1, textAlign: 'right', fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink }}>
        {value}
      </Text>
    </View>
  );
}

export default function ApplyReviewSheet({ job, onClose }: { job: Job | null; onClose: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { showToast } = useApp();
  const [prep, setPrep] = useState<PrepareResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!job) {
      setPrep(null);
      return;
    }
    let alive = true;
    setPrep(null);
    setSubmitting(false);
    prepareAutoApply(job.id).then((r) => {
      if (alive) setPrep(r);
    });
    return () => {
      alive = false;
    };
  }, [job]);

  const submit = async () => {
    if (!job) return;
    setSubmitting(true);
    try {
      await submitAutoApply(job.id, { dryRun: false });
      showToast(`Applying to ${job.title} — track it in Network › Applied`, true);
      qc.invalidateQueries({ queryKey: ['appliedJobs'] });
      onClose();
    } catch {
      showToast('Could not submit the application, try again');
      setSubmitting(false);
    }
  };

  const f = prep?.status === 'ok' ? prep.preview.fields : undefined;
  const sa = prep?.status === 'ok' ? (prep.preview.structured_answers as Record<string, unknown>) : undefined;
  const authYes = sa?.authorized_to_work_us;
  const sponsor = sa?.requires_sponsorship;

  return (
    <Modal visible={!!job} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 22,
            paddingTop: 14,
            paddingBottom: 34,
            maxHeight: '82%',
          }}>
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: colors.hairline }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Ionicons name="paper-plane" size={18} color={colors.accent} />
            <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 21, color: colors.heading }}>
              Review application
            </Text>
          </View>
          {job ? (
            <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.inkSecondary, marginBottom: 12 }}>
              {job.title} · {job.company}
            </Text>
          ) : null}

          {/* Body */}
          {!prep ? (
            <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkTertiary }}>
                Reading the application form…
              </Text>
            </View>
          ) : prep.status === 'profile_required' || prep.status === 'work_auth_required' ? (
            <View style={{ gap: 14, paddingVertical: 8 }}>
              <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, lineHeight: 21 }}>
                One-time setup first: auto-apply needs your work authorization before it can submit on
                your behalf. Takes about 15 seconds.
              </Text>
              <Button
                label="Set up application profile"
                onPress={() => {
                  onClose();
                  router.push('/application-profile');
                }}
              />
            </View>
          ) : prep.status === 'ineligible' ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, paddingVertical: 16 }}>
              This job isn’t on a supported application form (Greenhouse, Lever, or Ashby), so it can’t
              be auto-applied. Your outreach draft still went out.
            </Text>
          ) : prep.status !== 'ok' ? (
            <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, paddingVertical: 16 }}>
              {prep.message || 'Auto-apply isn’t available right now.'}
            </Text>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.inkTertiary, marginBottom: 4 }}>
                  APPLYING AS
                </Text>
                <Row label="Name" value={f?.full_name || `${f?.first_name ?? ''} ${f?.last_name ?? ''}`.trim()} />
                <Row label="Email" value={f?.email ?? ''} />
                <Row label="Phone" value={f?.phone ?? ''} />
                <Row label="LinkedIn" value={f?.linkedin_url ?? ''} />
                <Row label="Location" value={f?.location ?? ''} />

                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.inkTertiary, marginTop: 14, marginBottom: 4 }}>
                  WORK AUTHORIZATION
                </Text>
                <Row label="Authorized in US" value={authYes == null ? '—' : authYes ? 'Yes' : 'No'} />
                <Row label="Needs sponsorship" value={sponsor == null ? '—' : sponsor ? 'Yes' : 'No'} />

                <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.inkTertiary, marginTop: 14, marginBottom: 4 }}>
                  ATTACHED
                </Text>
                <Row label="Resume" value={prep.preview.resume?.has_resume ? prep.preview.resume.filename : 'None on file'} />

                {!prep.previewComplete ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'flex-start' }}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.waiting} />
                    <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary, lineHeight: 18 }}>
                      This form has questions we’ll answer with sensible defaults. If any need you, it’ll
                      show as “Needs your input” in Applied.
                    </Text>
                  </View>
                ) : null}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Skip" variant="ghost" onPress={onClose} disabled={submitting} />
                </View>
                <View style={{ flex: 2 }}>
                  <Button
                    label={submitting ? 'Submitting…' : 'Submit application'}
                    onPress={submit}
                    disabled={submitting}
                  />
                </View>
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.inkTertiary, textAlign: 'center', marginTop: 8 }}>
                Submitting sends a real application. It can’t be undone.
              </Text>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
