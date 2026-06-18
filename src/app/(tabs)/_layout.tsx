import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import GlassTabBackground from '@/components/GlassTabBackground';
import { needsAttention } from '@/app/(tabs)/inbox';
import { useApp } from '@/store/app';
import { useColors } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * Bottom navigation: Feed, Inbox, Network, Loops, Profile — the user's journey
 * (draft → replies → pipeline → autopilot → account), daily-use tabs left.
 * The bar is a liquid-glass surface (GlassTabBackground) with a hairline top
 * border and ink active state. The notification hub is the header bell, not
 * a tab. Scout is a summonable sheet from the header, not a tab.
 */
export default function TabsLayout() {
  const { outreach } = useApp();
  const colors = useColors();
  const attentionCount = outreach.filter(needsAttention).length;

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
          tabBarBadge: attentionCount > 0 ? attentionCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.negative, fontFamily: fonts.sansSemibold },
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
      <Tabs.Screen
        name="loops"
        options={{
          title: 'Loops',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="infinite" size={size} color={color} />
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
