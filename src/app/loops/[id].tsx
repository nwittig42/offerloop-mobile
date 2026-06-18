import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchLoop,
  fetchLoopActivity,
  runLoopNow,
  setLoopPaused,
  type LoopActivityItem,
} from '@/api/endpoints/loops';
import { qk } from '@/api/queryKeys';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

const LOOP_GRADIENT = ['#2563EB', '#4F46E5', '#7C3AED'] as const;

const ACTIVITY_ICON: Record<LoopActivityItem['type'], keyof typeof Ionicons.glyphMap> = {
  contact: 'person-outline',
  hm: 'briefcase-outline',
  job: 'document-text-outline',
  company: 'business-outline',
  draft: 'mail-outline',
};

/** "2026-06-17T..." -> "Jun 17". Empty string passes through. */
function dayLabel(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        gap: 3,
        borderWidth: 1,
        borderColor: tone + '33',
        backgroundColor: tone + '0F',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
      }}>
      <Text style={{ fontFamily: fonts.sansBold, fontSize: 22, color: colors.heading }}>{value}</Text>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11, color: colors.inkTertiary }}>{label}</Text>
    </View>
  );
}

export default function LoopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loopId = id ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const queryClient = useQueryClient();
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);

  const loopQuery = useQuery({
    queryKey: qk.loop(loopId),
    queryFn: () => fetchLoop(loopId),
    enabled: !!loopId,
  });
  const activityQuery = useQuery({
    queryKey: qk.loopActivityFor(loopId),
    queryFn: () => fetchLoopActivity(loopId),
    enabled: !!loopId,
  });

  const loop = loopQuery.data;
  const active = loop?.status === 'Active';
  const items = activityQuery.data ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: qk.loop(loopId) });
    queryClient.invalidateQueries({ queryKey: qk.loopActivityFor(loopId) });
    queryClient.invalidateQueries({ queryKey: qk.loops });
  };

  const onToggle = async () => {
    if (!loop || busy) return;
    setBusy(true);
    try {
      await setLoopPaused(loopId, active);
      showToast(active ? 'Loop paused' : 'Loop resumed');
      refresh();
    } catch {
      showToast('Could not update the Loop, try again');
    } finally {
      setBusy(false);
    }
  };

  const onRunNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await runLoopNow(loopId);
      showToast('Running a cycle now…');
      setTimeout(refresh, 1500);
    } catch {
      showToast('Could not run the Loop, try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        {active ? (
          <LinearGradient
            colors={LOOP_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="infinite" size={17} color="#FFFFFF" />
          </LinearGradient>
        ) : (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.inkTertiary + '22',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="infinite" size={17} color={colors.inkTertiary} />
          </View>
        )}
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontFamily: fonts.sansBold, fontSize: 18, color: colors.heading }}>
          Loop
        </Text>
        {loop ? <Chip label={loop.status} tone={active ? 'positive' : 'waiting'} dot /> : null}
      </View>

      {loopQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !loop ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: colors.inkSecondary, textAlign: 'center' }}>
            Could not load this Loop. Pull back and try again.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 40 }}>
          <Text style={{ fontFamily: fonts.sansMedium, fontSize: 16, color: colors.ink, lineHeight: 23 }}>
            {loop.brief}
          </Text>

          {/* The funnel — real Found/Emailed/Replied from contact records. */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile label="Found" value={loop.stats.found} tone={colors.navy} />
            <StatTile label="Emailed" value={loop.stats.emailed} tone={colors.accent} />
            <StatTile label="Replied" value={loop.stats.replied} tone={colors.positive} />
          </View>

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkSecondary }}>This week</Text>
              <Text style={{ fontFamily: fonts.sansMedium, fontSize: 12, color: colors.ink }}>
                {loop.stats.foundThisWeek} of {loop.weeklyTarget} found
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.hairlineLight, overflow: 'hidden' }}>
              <LinearGradient
                colors={LOOP_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: 6,
                  borderRadius: 3,
                  width: `${Math.min(100, Math.round((loop.stats.foundThisWeek / Math.max(1, loop.weeklyTarget)) * 100))}%`,
                }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              label={active ? 'Pause' : 'Resume'}
              variant="outline"
              size="sm"
              disabled={busy}
              onPress={onToggle}
            />
            <Button label="Run now" variant="brand" size="sm" disabled={busy} onPress={onRunNow} />
          </View>

          {/* What the Loop has surfaced — the contact/job list. */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.ink }}>
              What this Loop found
            </Text>
            {activityQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 10 }} />
            ) : items.length === 0 ? (
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: colors.inkSecondary, lineHeight: 20 }}>
                Nothing yet. When this Loop runs a cycle, the people and roles it finds show up
                here.
              </Text>
            ) : (
              items.map((it) => (
                <Card key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: colors.accent + '14',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Ionicons name={ACTIVITY_ICON[it.type] ?? 'ellipse-outline'} size={16} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink }}>
                      {it.title}
                    </Text>
                    {it.subtitle ? (
                      <Text numberOfLines={1} style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.inkTertiary }}>
                        {it.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {dayLabel(it.createdAt) ? (
                    <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: colors.inkTertiary }}>
                      {dayLabel(it.createdAt)}
                    </Text>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
