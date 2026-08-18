import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Share, Text, View } from 'react-native';

import { fetchReferral } from '@/api/endpoints/referral';
import { track } from '@/lib/analytics';
import { fonts } from '@/theme/tokens';

/**
 * Referral CTA — invite friends, unlock Elite free. The app's highest-leverage
 * growth loop (App Store distribution + virality). Compliant by construction: it
 * SHARES a link and DISPLAYS progress; the reward is granted web-side, so nothing
 * is sold or granted in-app, and it never quotes a price. Renders nothing until
 * the referral endpoint answers, so it can't show a broken card.
 */
const shareMessage = (url: string) =>
  `Join me on Offerloop, it finds real people at your target companies and writes your intro emails for you. Sign up with my link: ${url}`;

export default function ReferralCard({ compact }: { compact?: boolean }) {
  const q = useQuery({ queryKey: ['referral'], queryFn: fetchReferral, staleTime: 60_000 });
  const r = q.data;
  if (!r) return null;

  const remaining = Math.max(0, r.goal - r.joined);
  const invite = () => {
    track('referral_invite_tapped', { joined: r.joined, from: compact ? 'compact' : 'card' });
    Share.share({ message: shareMessage(r.shareUrl), url: r.shareUrl }).catch(() => {});
  };

  // Compact = one slim row (Profile uses this: the full card pushed the tab
  // strip below the fold). Same gradient identity, real progress count, plus
  // the segmented tick-off bar underneath (Rylan 2026-08-10): progress you
  // can SEE beats a fraction you have to read.
  if (compact) {
    return (
      <Pressable onPress={invite} accessibilityRole="button">
        <LinearGradient
          colors={r.unlocked ? (['#059669', '#10B981'] as const) : (['#2563EB', '#7C3AED'] as const)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 11,
            gap: 9,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name={r.unlocked ? 'trophy' : 'gift'} size={15} color="#FFFFFF" />
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 13, color: '#FFFFFF' }}>
              {r.unlocked ? 'Elite unlocked, thank you!' : 'Invite friends, unlock Elite free'}
            </Text>
            {!r.unlocked ? (
              <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12, color: '#EAF0FF' }}>
                {r.joined}/{r.goal}
              </Text>
            ) : null}
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </View>
          {!r.unlocked ? (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {Array.from({ length: r.goal }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: i < r.joined ? '#FFFFFF' : 'rgba(255,255,255,0.28)',
                  }}
                />
              ))}
            </View>
          ) : null}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={invite} accessibilityRole="button">
      <LinearGradient
        colors={r.unlocked ? (['#059669', '#10B981'] as const) : (['#2563EB', '#7C3AED'] as const)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 16, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name={r.unlocked ? 'trophy' : 'gift'} size={18} color="#FFFFFF" />
          <Text style={{ flex: 1, fontFamily: fonts.sansSemibold, fontSize: 15.5, color: '#FFFFFF' }}>
            {r.unlocked ? 'Elite unlocked, thank you!' : 'Invite friends, unlock Elite free'}
          </Text>
          <Ionicons name="share-outline" size={17} color="#FFFFFF" />
        </View>

        <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: '#EAF0FF', lineHeight: 19 }}>
          {r.unlocked
            ? 'You brought 5 friends to Offerloop, Elite is on us.'
            : `${r.joined} of ${r.goal} joined. Invite ${remaining} more friend${remaining === 1 ? '' : 's'} who make an account and Elite is yours, free.`}
        </Text>

        {/* Segmented progress toward the goal. */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: r.goal }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                backgroundColor: i < r.joined ? '#FFFFFF' : 'rgba(255,255,255,0.28)',
              }}
            />
          ))}
        </View>

        {!r.unlocked ? (
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              marginTop: 2,
            }}>
            <Ionicons name="person-add" size={13} color="#FFFFFF" />
            <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 12.5, color: '#FFFFFF' }}>
              Invite friends
            </Text>
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}
