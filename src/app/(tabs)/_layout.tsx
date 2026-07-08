import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import GlassTabBackground from '@/components/GlassTabBackground';
import { needsAttention } from '@/app/(tabs)/inbox';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Bottom navigation: Feed, Inbox, Network, Scout, Profile — the user's journey
 * (draft → replies → pipeline → assistant → account), daily-use tabs left.
 * The bar is a liquid-glass surface (GlassTabBackground) with a hairline top
 * border and ink active state; the Scout tab overrides it with its night bar.
 * The notification hub is the header bell, not a tab. Loops became Scout's
 * background engine — the old screen survives at /loops for deep links.
 */
export default function TabsLayout() {
  const { outreach } = useApp();
  const colors = useColors();
  const attentionCount = outreach.filter(needsAttention).length;
  // Cap the displayed count so a big number (200+) doesn't clip the badge.
  const badgeValue = attentionCount > 99 ? '99+' : attentionCount;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.inkTertiary,
        tabBarBackground: () => <GlassTabBackground />,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sansMedium,
          fontSize: 10.5,
        },
      }}>
      <Tabs.Screen
        name="index"
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
      <Tabs.Screen
        name="network"
        options={{
          title: 'Network',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      {/* Scout replaced Loops in the bar (PLAN-scout-voice.md P1); the Loops
          screen lives on at /loops for deep links + the Ongoing section. The
          Scout screen is a committed night room, so its bar goes dark too. */}
      <Tabs.Screen
        name="scout"
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
