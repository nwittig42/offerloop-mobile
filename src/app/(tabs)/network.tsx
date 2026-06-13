import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import Header from '@/components/Header';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useApp } from '@/store/app';
import { colors, fonts } from '@/theme/tokens';
import type { TrackerBucket } from '@/types';

/**
 * Network: the mobile-lite tracker. Big serif numbers up top (counted from
 * actual store data, never hardcoded), then the same buckets as the web
 * pipeline. Read-mostly by design: deep pipeline work stays on the web.
 */

const BUCKETS: { key: TrackerBucket; label: string }[] = [
  { key: 'attention', label: 'Needs attention' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' },
];

function BigNumber({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 44, color: colors.heading }}>
        {value}
      </Text>
      <Text style={{ fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.inkSecondary }}>
        {label}
      </Text>
    </View>
  );
}

export default function NetworkScreen() {
  const router = useRouter();
  const { outreach, trackerRows, unreadCount } = useApp();
  const [bucket, setBucket] = useState<TrackerBucket>('attention');

  const sentCount = outreach.filter((o) => o.status === 'sent' || o.status === 'replied').length;
  const repliedCount = outreach.filter((o) => o.status === 'replied').length;
  const rows = trackerRows.filter((r) => r.bucket === bucket);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header
        title="Network"
        unreadCount={unreadCount}
        onBellPress={() => router.push('/notifications')}
      />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Card style={{ flexDirection: 'row', paddingVertical: 24 }}>
          <BigNumber value={sentCount} label="Outreach sent" />
          <View style={{ width: 1, backgroundColor: colors.hairlineLight }} />
          <BigNumber value={repliedCount} label="Replies" />
          <View style={{ width: 1, backgroundColor: colors.hairlineLight }} />
          <BigNumber value={trackerRows.length} label="Contacts" />
        </Card>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {BUCKETS.map((b) => {
            const selected = b.key === bucket;
            return (
              <Pressable
                key={b.key}
                onPress={() => setBucket(b.key)}
                style={{
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: selected ? colors.ink : colors.hairline,
                  backgroundColor: selected ? colors.ink : colors.paper,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}>
                <Text
                  style={{
                    fontFamily: fonts.sansMedium,
                    fontSize: 12.5,
                    color: selected ? colors.paper : colors.inkSecondary,
                  }}>
                  {b.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 8 }}>
          {rows.length === 0 ? (
            <Card>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13.5, color: colors.inkSecondary }}>
                Nothing in this bucket right now.
              </Text>
            </Card>
          ) : (
            rows.map((row) => (
              <Card key={row.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.paper2,
                    borderWidth: 1,
                    borderColor: colors.hairline,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.navy }}>
                    {row.contactName
                      .split(' ')
                      .map((p) => p.charAt(0))
                      .slice(0, 2)
                      .join('')}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14.5, color: colors.ink }}>
                    {row.contactName}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.inkSecondary }}>
                    {row.company}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: colors.inkTertiary }}>
                    {row.lastActivity}
                  </Text>
                </View>
                <Chip label={row.statusLabel} tone={row.statusTone} dot />
              </Card>
            ))
          )}
        </View>

        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            color: colors.inkTertiary,
            textAlign: 'center',
            paddingTop: 8,
          }}>
          The full pipeline, stages, and notes live on offerloop.ai
        </Text>
      </ScrollView>
    </View>
  );
}
