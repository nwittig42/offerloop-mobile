import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * One concrete edit Scout proposed for the resume: a section, what it says
 * now, and what to write instead. Same shape the backend's tailor_resume_to_job
 * and improve_resume_for_target tools both return.
 */
export type ScoutEdit = { id: string; section: string; current: string; suggested: string };

/**
 * "Approve or disapprove things for the resume" (Rylan 2026-09-09): Scout's
 * suggestions land here as a checklist, not a blanket rewrite. Every edit
 * starts approved (the common case is "yes, all of these"), and a tap turns
 * one off. Apply sends only the approved ones through the normal refine
 * step, so nothing changes on the resume without a look first.
 */
export function ScoutEditsReview({
  edits,
  onApply,
  onDismiss,
  busy,
}: {
  edits: ScoutEdit[];
  onApply: (approved: ScoutEdit[]) => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const colors = useColors();
  const [approved, setApproved] = useState<Set<string>>(() => new Set(edits.map((e) => e.id)));
  const toggle = (id: string) =>
    setApproved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const approvedEdits = edits.filter((e) => approved.has(e.id));

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="sparkles-outline" size={17} color={colors.marketing} />
        <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
          Scout&apos;s suggested edits
        </Text>
        <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss suggestions">
          <Ionicons name="close" size={18} color={colors.inkTertiary} />
        </Pressable>
      </View>
      <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary, lineHeight: 18 }}>
        Everything is checked. Tap one to leave it out, then apply the rest.
      </Text>

      {edits.map((e) => {
        const on = approved.has(e.id);
        return (
          <Pressable
            key={e.id}
            onPress={() => toggle(e.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={{
              flexDirection: 'row',
              gap: 10,
              padding: 10,
              borderRadius: 8,
              backgroundColor: colors.surface,
              opacity: on ? 1 : 0.5,
            }}>
            <Ionicons
              name={on ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={on ? colors.positive : colors.inkTertiary}
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1, gap: 6 }}>
              {e.section ? (
                <Text
                  style={{
                    fontFamily: fonts.sansSemibold,
                    fontSize: 11,
                    color: colors.inkTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}>
                  {e.section}
                </Text>
              ) : null}
              {/* A real diff (Rylan 2026-09-10): the old line tinted red and
                  struck through, the new line tinted green, stacked. */}
              {e.current ? (
                <View
                  style={{
                    backgroundColor: colors.negative + '14',
                    borderRadius: 6,
                    paddingVertical: 5,
                    paddingHorizontal: 8,
                  }}>
                  <Text
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 12.5,
                      color: colors.negative,
                      textDecorationLine: 'line-through',
                      lineHeight: 18,
                    }}>
                    {e.current}
                  </Text>
                </View>
              ) : null}
              <View
                style={{
                  backgroundColor: colors.positive + '16',
                  borderRadius: 6,
                  paddingVertical: 5,
                  paddingHorizontal: 8,
                }}>
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.ink, lineHeight: 19 }}>
                  {e.suggested}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}

      <Button
        label={
          busy
            ? 'Applying…'
            : approvedEdits.length
              ? `Apply ${approvedEdits.length} approved edit${approvedEdits.length === 1 ? '' : 's'}`
              : 'Nothing approved'
        }
        variant="brand"
        fullWidth
        disabled={busy || !approvedEdits.length}
        onPress={() => onApply(approvedEdits)}
      />
    </Card>
  );
}

export default ScoutEditsReview;
