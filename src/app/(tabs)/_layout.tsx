import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listAppliedJobs, needsUserCount } from '@/api/endpoints/autoApply';
import GlassTabBackground from '@/components/GlassTabBackground';
import { needsAttention } from '@/app/(tabs)/inbox';
import { useApp } from '@/store/app';
import { useColors, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

// Scout's night bar, promoted to the whole bar's dark-mode look so the nav reads
// as one deep surface instead of a lighter glass slab under dark screens.
const SCOUT_BAR_BG = '#0A111F';
const SCOUT_BAR_BORDER = 'rgba(160,190,255,0.18)';

/**
 * Tab bar content height: the icon and label box. Apple's stock value is 49pt,
 * which fits SF Symbols and a 10pt label exactly and left this bar's labels
 * touching its bottom edge. 58 gives them room without making the bar heavy.
 *
 * The bar's total height is this plus the bottom safe-area inset, and the bar's
 * BACKGROUND fills that inset. That is not a gap under the bar, it is the bar
 * running to the physical bottom edge, which is what iOS does. Nothing is ever
 * added below it: no floor, no minimum, no padding the platform did not ask
 * for. On a browser and on an SE the inset is 0 and the bar simply ends at the
 * bottom of the screen.
 */
const TAB_BAR_CONTENT_HEIGHT = 58;

/**
 * Bottom navigation: Feed, Inbox, Scout, Network, Profile — Scout dead
 * center as the app's home button, daily-use tabs flanking it.
 * The bar is a white liquid-glass surface (GlassTabBackground) with a 1pt top
 * border and ink active state; the Scout tab overrides it with its night bar.
 * The notification hub is the header bell, not a tab. Loops became Scout's
 * background engine — the old screen survives at /loops for deep links.
 */
export default function TabsLayout() {
  const { outreach } = useApp();
  const colors = useColors();
  const { scheme } = useTheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  // Shared by the default bar and the Scout override, so the bar never changes
  // height as you move between tabs. No paddingTop: the navigator centers the
  // icon and label in the content box on its own, and adding top padding just
  // squeezed the label until it clipped.
  const barMetrics = {
    height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
    paddingBottom: insets.bottom,
  } as const;
  const attentionCount = outreach.filter(needsAttention).length;
  // Cap the displayed count so a big number (200+) doesn't clip the badge.
  const badgeValue = attentionCount > 99 ? '99+' : attentionCount;

  // Applications stopped on a question only the student can answer. It rides
  // the Network tab because that is where the work is done, and it counts the
  // exact group pinned at the top of /applications, so tapping through and
  // finishing clears the badge. Shares the query key with both screens, so the
  // bar never disagrees with the list.
  const appliedQuery = useQuery({ queryKey: ['applied-jobs'], queryFn: () => listAppliedJobs() });
  const networkAttention = needsUserCount(appliedQuery.data);
  const networkBadge = networkAttention > 99 ? '99+' : networkAttention;

  return (
    <>
      {/* Notification priming. Lives here (not just onboarding) so it fires on
          every app open after sign-in until the user actually turns pushes on —
          "Not now" is per-launch only. Renders nothing once permission is granted. */}
      <Tabs
      screenOptions={{
        headerShown: false,
        // The scene container defaults to the navigation theme's white. Every
        // tab paints its own body, but the safe-area strip the navigator pads
        // around it was left showing that white: invisible in light mode, a
        // white band above the header in dark.
        sceneStyle: { backgroundColor: colors.surface },
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.inkTertiary,
        // Dark mode: solid Scout-night bar across all tabs (no glass), so the nav
        // matches Scout's deep surface. Light mode keeps the liquid-glass bar.
        tabBarBackground: isDark ? () => null : () => <GlassTabBackground />,
        tabBarStyle: {
          ...barMetrics,
          backgroundColor: isDark ? SCOUT_BAR_BG : 'transparent',
          // A full point, not a hairline. The bar is white now and the feed
          // behind it is near-white, so a sub-pixel #E5E5E0 line disappeared
          // entirely and the nav had no edge at all. This is the only thing
          // separating the two surfaces.
          borderTopWidth: 1,
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
          /loops for deep links only. Scout used to force a night bar on top
          of a light app; it follows the Light/Dark setting with everything
          else now (2026-08-17), so no per-screen bar override here. */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scout',
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
          tabBarBadge: networkAttention > 0 ? networkBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.negative, fontFamily: fonts.sansSemibold, fontSize: 10 },
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
