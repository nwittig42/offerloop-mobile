import { Component, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { fonts } from '@/theme/tokens';

/**
 * Catches render/runtime errors inside the Scout tab so a bug shows a
 * readable card (with the actual message — the phone becomes the debugger)
 * instead of crashing the whole app. Try-again resets the subtree.
 */
export default class ScoutErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const message = String(this.state.error?.message || this.state.error);
    const stack = String((this.state.error as Error)?.stack || '').split('\n').slice(0, 6).join('\n');
    return (
      <View style={{ flex: 1, backgroundColor: '#0C1526', alignItems: 'center', justifyContent: 'center', padding: 26, gap: 14 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#EAF0FF' }}>
          Scout hit a snag
        </Text>
        <ScrollView style={{ maxHeight: 260, alignSelf: 'stretch' }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 13, color: '#FCA5A5' }}>
            {message}
          </Text>
          <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: '#8FA3CC', marginTop: 8 }}>
            {stack}
          </Text>
        </ScrollView>
        <Pressable
          onPress={() => this.setState({ error: null })}
          style={{ backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 22 }}>
          <Text style={{ fontFamily: fonts.sansSemibold, fontSize: 14, color: '#fff' }}>Try again</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.sans, fontSize: 11.5, color: '#5A6B8F', textAlign: 'center' }}>
          Screenshot this card — it tells us exactly what broke.
        </Text>
      </View>
    );
  }
}
