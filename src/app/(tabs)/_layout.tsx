import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import GlassTabBackground from '@/components/GlassTabBackground';
import NotificationsGate from '@/components/NotificationsGate';
import { needsAttention } from '@/app/(tabs)/inbox';
import { useApp } from '@/store/app';
import { useColors, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

// Scout's night bar, promoted to the whole bar's dark-mode look so the nav reads
// as one deep surface instead of a lighter glass slab under dark screens.
const SCOUT_BAR_BG = '#0A111F';
const SCOUT_BAR_BORDER = 'rgba(160,190,255,0.18)';

/**
 * Bottom navigation: Feed, Inbox, Scout, Network, Profile — Scout dead
 * center as the app's home button, daily-use tabs flanking it.
 * The bar is a liquid-glass surface (GlassTabBackground) with a hairline top
 * border and ink active state; the Scout tab overrides it with its night bar.
 * The notification hub is the header bell, not a tab. Loops became Scout's
 * background engine — the old screen survives at /loops for deep links.
 */
export default function TabsLayout() {
  const { outreach } = useApp();
  const colors = useColors();
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const attentionCount = outreach.filter(needsAttention).length;
  // Cap the displayed count so a big number (200+) doesn't clip the badge.
  const badgeValue = attentionCount > 99 ? '99+' : attentionCount;

  return (
    <>
      {/* Notification priming. Lives here (not just onboarding) so it fires on
          every app open after sign-in until the user actually turns pushes on —
          "Not now" is per-launch only. Renders nothing once permission is granted. */}
      <NotificationsGate />
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.inkTertiary,
        // Dark mode: solid Scout-night bar across all tabs (no glass), so the nav
        // matches Scout's deep surface. Light mode keeps the liquid-glass bar.
        tabBarBackground: isDark ? () => null : () => <GlassTabBackground />,
        tabBarStyle: {
          backgroundColor: isDark ? SCOUT_BAR_BG : 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: isDark ? SCOUT_BAR_BORDER : colors.hairline,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sansMedium,
          fontSize: 10.5,
        },
      }}>
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'albums' : 'albums-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarBadge: attentionCount > 0 ? badgeValue : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.negative, fontFamily: fonts.sansSemibold, fontSize: 10 },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'mail' : 'mail-outline'} size={size} color={color} />
          ),
        }}
      />
      {/* Scout replaced Loops in the bar (PLAN-scout-voice.md P1) and sits
          dead center — the orb is the app's home button. Loops are shelved
          for v1 (one-shot Scout covers the job); the old screen survives at
          /loops for deep links only. The Scout screen is a committed night
          room, so its bar goes dark too. */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scout',
          tabBarActiveTintColor: '#EAF0FF',
          tabBarInactiveTintColor: colors.inkTertiary,
          tabBarStyle: {
            backgroundColor: '#0A111F',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: 'rgba(160,190,255,0.18)',
            elevation: 0,
          },
          tabBarBackground: () => null,
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'bag-personal' : 'bag-personal-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: 'Network',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
      </Tabs>
    </>
  );
}
