import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Dimensions, Platform, Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeOut,
  FadeOutDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import Card from '@/components/ui/Card';
import { useColors, useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The item-agnostic swipe stack: gestures, physics, stamps, and the peeking
 * next card. It knows nothing about jobs or people.
 *
 * This is the shared body behind both decks. SwipeDeck (jobs) and PersonDeck
 * (people) are thin wrappers that supply the card renderer and the stamp
 * labels, so the two feeds cannot drift apart in feel. A swipe commits at the
 * same threshold and springs back with the same damping in both.
 */

/** GestureDetector on native, a plain passthrough in the browser. */
function MaybeGestureDetector({
  gesture,
  children,
}: {
  gesture: ReturnType<typeof Gesture.Simultaneous>;
  children: React.ReactElement;
}) {
  if (Platform.OS === 'web') return children;
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const COMMIT_THRESHOLD = SCREEN_W * 0.32;
const FLING_VELOCITY = 900;

export type SwipeStackHandle = {
  swipe: (direction: 'left' | 'right') => void;
  save: () => void;
};

/** What the stamp says and which tone it carries. */
export type StampSpec = {
  label: string;
  tone: 'accent' | 'positive' | 'negative' | 'marketing';
};

export type SwipeStackProps<T> = {
  items: T[];
  /** Stable identity per item, used as the React key on the card. */
  keyOf: (item: T) => string;
  /** Draw one card. `expanded` is true only for the top card when opened. */
  renderCard: (item: T, expanded: boolean, onCollapse: () => void) => ReactNode;
  expanded: boolean;
  onToggleExpand: (expanded: boolean) => void;
  /** 'up' fires only when `allowUp` is true. */
  onSwiped: (direction: 'left' | 'right' | 'up', item: T) => void;
  /** Mirrors the live horizontal drag so action buttons can react to it. */
  drag?: SharedValue<number>;
  /** When true, a right swipe cannot complete: the card hits an invisible wall
   *  and springs back, and onBlockedRight fires so the caller can say why. */
  blockRight?: boolean;
  onBlockedRight?: () => void;
  rightStamp: StampSpec;
  leftStamp: StampSpec;
  /** Swipe up to save. Off for decks where up means nothing. */
  allowUp?: boolean;
  upStamp?: StampSpec;
  /**
   * What an up-commit DOES. 'save' flies the card away (the classic save
   * for later). 'expand' opens reading mode instead (Rylan 2026-08-18:
   * pull-up-for-more is the intuition everyone already has), springing the
   * card back under the enlarged view. The commit threshold + fling gate
   * are unchanged, so a drifting thumb still just springs back.
   */
  upAction?: 'save' | 'expand';
  /**
   * The instant win. Shown for about a second after a right swipe commits: a
   * springy check with a line saying what is happening and WHERE it went
   * ("Drafting your email" / "Lands in your Inbox"). The card flying off
   * says "gone"; this says "working for you", which is the half a user
   * cannot infer. Per deck so Jobs and People can name their own outcome.
   */
  rightWin?: { title: string; caption?: string };
  /** Same slot for swipe-up-to-save, when the deck allows up. */
  upWin?: { title: string; caption?: string };
  /** Undo, worn by the card's top-right corner so it travels WITH the swipe
   *  instead of floating (Rylan 2026-08-18 round 4). Hidden while expanded
   *  (the collapse chevron owns that corner in reading mode). */
  undo?: { visible: boolean; onPress: () => void; position?: 'top-right' | 'bottom-right' };
  /** Veto for the win toast. The stack cannot know a swipe is about to be
   *  refused downstream (out of credits bounces the job back AFTER the
   *  fly-out), and celebrating an action that did not happen is worse than no
   *  toast. Defaults to celebrating every completed swipe. */
  shouldCelebrate?: (direction: 'left' | 'right' | 'up', item: T) => boolean;
  /**
   * Spoken description of the top card, and the names of its actions.
   *
   * Dragging a card is a CUSTOM gesture, and VoiceOver swallows drags, so
   * without this a VoiceOver, Switch Control, or Voice Control user cannot act
   * on a card at all. Apple's HIG requires every custom gesture to have a tap
   * or menu equivalent (rule 5.7, and 6.3). These become rotor actions, which
   * satisfies it without putting a button on screen for everyone else.
   */
  a11yLabel?: (item: T) => string;
  rightActionLabel?: string;
  leftActionLabel?: string;
  upActionLabel?: string;
};

function Stamp({ spec }: { spec: StampSpec }) {
  const colors = useColors();
  const color =
    spec.tone === 'negative'
      ? colors.negative
      : spec.tone === 'marketing'
        ? colors.marketing
        : spec.tone === 'positive'
          ? colors.positive
          : colors.accent;
  // A pass tilts right, a commit tilts left, a save sits centered. Matching the
  // original deck exactly so the two feeds read identically.
  const centered = spec.tone === 'marketing';
  const isPass = spec.tone === 'negative';
  return (
    <View
      style={{
        position: 'absolute',
        top: 22,
        left: centered ? 0 : isPass ? undefined : 20,
        right: centered ? 0 : isPass ? 20 : undefined,
        alignItems: centered ? 'center' : undefined,
      }}>
      <View
        style={{
          transform: [{ rotate: centered ? '0deg' : isPass ? '12deg' : '-12deg' }],
          borderWidth: 3,
          borderColor: color,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 2,
          backgroundColor: colors.paper,
        }}>
        <Text
          style={{
            fontFamily: fonts.sansBold,
            fontSize: 26,
            letterSpacing: 2,
            color,
          }}>
          {spec.label}
        </Text>
      </View>
    </View>
  );
}

/**
 * The one-second payoff after a swipe commits. Right and up get the full
 * treatment (springy check card, what is happening, where it landed); left
 * gets a quiet wisp, because a pass is housekeeping, not a win.
 */
function WinToast({
  direction,
  title,
  caption,
}: {
  direction: 'left' | 'right' | 'up';
  title: string;
  caption?: string;
}) {
  const colors = useColors();
  if (direction === 'left') {
    return (
      <Animated.View
        entering={ZoomIn.springify().damping(14)}
        exiting={FadeOut.duration(200)}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.ink + 'B8',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
          }}>
          <Ionicons name="close" size={15} color="#FFFFFF" />
          <Text style={{ fontFamily: fonts.sansBold, fontSize: 13.5, color: '#FFFFFF' }}>
            {title}
          </Text>
        </View>
      </Animated.View>
    );
  }
  const tone = direction === 'up' ? colors.marketing : colors.positive;
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(11).stiffness(240)}
      exiting={FadeOutDown.duration(260)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.paper,
          paddingHorizontal: 26,
          paddingVertical: 20,
          borderRadius: 18,
          shadowColor: tone,
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}>
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tone,
            marginBottom: 10,
            shadowColor: tone,
            shadowOpacity: 0.45,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}>
          <Ionicons
            name={direction === 'up' ? 'bookmark' : 'checkmark'}
            size={30}
            color="#FFFFFF"
          />
        </View>
        <Text style={{ fontFamily: fonts.sansBold, fontSize: 16.5, color: colors.heading }}>
          {title}
        </Text>
        {caption ? (
          <Text
            style={{
              fontFamily: fonts.sansMedium,
              fontSize: 13,
              color: colors.inkSecondary,
              marginTop: 3,
            }}>
            {caption}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function SwipeStackInner<T>(
  {
    items,
    keyOf,
    renderCard,
    expanded,
    onToggleExpand,
    onSwiped,
    drag,
    blockRight = false,
    onBlockedRight,
    rightStamp,
    leftStamp,
    allowUp = true,
    upStamp,
    upAction = 'save',
    rightWin,
    upWin,
    undo,
    shouldCelebrate,
    a11yLabel,
    rightActionLabel,
    leftActionLabel,
    upActionLabel,
  }: SwipeStackProps<T>,
  ref: React.Ref<SwipeStackHandle>,
) {
  const colors = useColors();
  const { scheme } = useTheme();
  // Dark mode deck cards go rich navy instead of the app's dark paper
  // (Rylan 2026-08-18: the paper read as washed/opaque against the night
  // sky; the cards should feel like solid night-blue objects).
  const cardBg = scheme === 'dark' ? { backgroundColor: '#1A2B4D' } : null;
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  /** Web drag origin; unused on native. */
  const webStart = useRef({ x: 0, y: 0, active: false });

  const top = items[0];
  const next = items[1];

  /** The post-swipe payoff, keyed so back-to-back swipes re-pop the spring. */
  const [win, setWin] = useState<{ direction: 'left' | 'right' | 'up'; key: number } | null>(null);
  const winTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (winTimer.current) clearTimeout(winTimer.current);
    },
    [],
  );

  const celebrate = (direction: 'left' | 'right' | 'up') => {
    // No haptics here on purpose: the deck screens already buzz on commit and
    // on server confirmation (see feed.tsx / PeopleFeedView handleSwiped), so
    // a buzz in the shared stack would stack on top of theirs. This layer owns
    // the VISUAL payoff only.
    setWin({ direction, key: Date.now() });
    if (winTimer.current) clearTimeout(winTimer.current);
    winTimer.current = setTimeout(() => setWin(null), direction === 'left' ? 550 : 1050);
  };

  const finish = (direction: 'left' | 'right' | 'up') => {
    const item = items[0];
    tx.value = 0;
    ty.value = 0;
    onToggleExpand(false);
    if (item && (!shouldCelebrate || shouldCelebrate(direction, item))) celebrate(direction);
    if (item) onSwiped(direction, item);
  };

  const flyOut = (direction: 'left' | 'right') => {
    'worklet';
    const target = (direction === 'right' ? 1 : -1) * SCREEN_W * 1.4;
    if (drag) drag.value = withTiming(0, { duration: 180 });
    ty.value = withTiming(ty.value + 40, { duration: 240 });
    tx.value = withTiming(target, { duration: 240 }, (finished) => {
      if (finished) runOnJS(finish)(direction);
    });
  };

  const settleBack = () => {
    'worklet';
    tx.value = withSpring(0, { damping: 14, stiffness: 220 });
    ty.value = withSpring(0, { damping: 14, stiffness: 220 });
    if (drag) drag.value = withSpring(0, { damping: 14, stiffness: 220 });
  };

  const commitUp = () => {
    'worklet';
    if (upAction === 'expand') {
      // Reading mode, not a departure: the card springs home while the
      // screen clears the stage around it.
      settleBack();
      runOnJS(onToggleExpand)(true);
      return;
    }
    flyUp();
  };

  const flyUp = () => {
    'worklet';
    if (drag) drag.value = withTiming(0, { duration: 180 });
    ty.value = withTiming(-SCREEN_H * 1.2, { duration: 260 }, (finished) => {
      if (finished) runOnJS(finish)('up');
    });
  };

  useImperativeHandle(ref, () => ({
    swipe: (direction) => {
      if (direction === 'right' && blockRight) {
        onBlockedRight?.();
        return;
      }
      flyOut(direction);
    },
    save: () => {
      if (!allowUp) return;
      if (upAction === 'expand') onToggleExpand(true);
      else flyUp();
    },
  }));

  // Pan handles horizontal always, and (on a COLLAPSED card, when the deck
  // allows it) vertical up too, so swipe-up-to-save gets the same physics as
  // left/right. On an EXPANDED card, failOffsetY lets the description scroll.
  let pan = Gesture.Pan().activeOffsetX([-14, 14]);
  pan =
    expanded || !allowUp
      ? pan.failOffsetY([-16, 16])
      : pan.activeOffsetY([-14, 100000]);
  pan = pan
    .onUpdate((e) => {
      tx.value = e.translationX;
      if (
        allowUp &&
        !expanded &&
        e.translationY < 0 &&
        Math.abs(e.translationY) > Math.abs(e.translationX)
      ) {
        ty.value = e.translationY;
      } else {
        ty.value = e.translationY * 0.4;
      }
      if (drag) drag.value = e.translationX;
    })
    .onEnd((e) => {
      const upCommit =
        allowUp &&
        !expanded &&
        Math.abs(ty.value) > Math.abs(tx.value) &&
        (ty.value < -COMMIT_THRESHOLD || e.velocityY < -FLING_VELOCITY);
      if (upCommit) {
        commitUp();
      } else if (tx.value > COMMIT_THRESHOLD || e.velocityX > FLING_VELOCITY) {
        if (blockRight) {
          tx.value = withSpring(0, { damping: 11, stiffness: 260 });
          ty.value = withSpring(0, { damping: 11, stiffness: 260 });
          if (drag) drag.value = withSpring(0, { damping: 11, stiffness: 260 });
          if (onBlockedRight) runOnJS(onBlockedRight)();
        } else {
          flyOut('right');
        }
      } else if (tx.value < -COMMIT_THRESHOLD || e.velocityX < -FLING_VELOCITY) {
        flyOut('left');
      } else {
        tx.value = withSpring(0, { damping: 16, stiffness: 180 });
        ty.value = withSpring(0, { damping: 16, stiffness: 180 });
        if (drag) drag.value = withSpring(0, { damping: 16, stiffness: 180 });
      }
    });

  /**
   * Mouse dragging, web only. react-native-gesture-handler has no web
   * implementation (MaybeGestureDetector bypasses it in the browser), so
   * without this the card cannot be swiped at all in the localhost preview.
   * The Responder system does work on web, so it drives the same tx/ty/drag
   * values and the same commit thresholds. Native never sees any of this.
   */
  const webPan =
    Platform.OS === 'web'
      ? {
          onStartShouldSetResponder: () => true,
          onMoveShouldSetResponder: () => true,
          onResponderTerminationRequest: () => false,
          onResponderGrant: () => {
            webStart.current = { x: 0, y: 0, active: true };
          },
          onResponderMove: (e: GestureResponderEvent) => {
            if (!webStart.current.active) return;
            const { dx, dy } = { dx: e.nativeEvent.pageX, dy: e.nativeEvent.pageY };
            if (webStart.current.x === 0 && webStart.current.y === 0) {
              webStart.current = { x: dx, y: dy, active: true };
              return;
            }
            const tX = dx - webStart.current.x;
            const tY = dy - webStart.current.y;
            tx.value = tX;
            ty.value =
              allowUp && !expanded && tY < 0 && Math.abs(tY) > Math.abs(tX) ? tY : tY * 0.4;
            if (drag) drag.value = tX;
          },
          onResponderRelease: () => {
            webStart.current = { x: 0, y: 0, active: false };
            const x = tx.value;
            const y = ty.value;
            if (allowUp && !expanded && Math.abs(y) > Math.abs(x) && y < -COMMIT_THRESHOLD) {
              commitUp();
            } else if (x > COMMIT_THRESHOLD) {
              if (blockRight) {
                tx.value = withSpring(0, { damping: 11, stiffness: 260 });
                ty.value = withSpring(0, { damping: 11, stiffness: 260 });
                if (drag) drag.value = withSpring(0, { damping: 11, stiffness: 260 });
                onBlockedRight?.();
              } else {
                flyOut('right');
              }
            } else if (x < -COMMIT_THRESHOLD) {
              flyOut('left');
            } else {
              tx.value = withSpring(0, { damping: 16, stiffness: 180 });
              ty.value = withSpring(0, { damping: 16, stiffness: 180 });
              if (drag) drag.value = withSpring(0, { damping: 16, stiffness: 180 });
            }
          },
          onResponderTerminate: () => {
            webStart.current = { x: 0, y: 0, active: false };
            tx.value = withSpring(0, { damping: 16, stiffness: 180 });
            ty.value = withSpring(0, { damping: 16, stiffness: 180 });
            if (drag) drag.value = withSpring(0, { damping: 16, stiffness: 180 });
          },
        }
      : {};

  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd(() => {
      if (!expanded) runOnJS(onToggleExpand)(true);
    });
  const gesture = Gesture.Simultaneous(pan, tap);

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${tx.value / 18}deg` },
    ],
  }));

  const rightStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [30, 110], [0, 1], Extrapolation.CLAMP),
  }));

  const leftStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-110, -30], [1, 0], Extrapolation.CLAMP),
  }));

  const upStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [-110, -30], [1, 0], Extrapolation.CLAMP),
  }));

  const nextStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      Math.abs(tx.value),
      [0, COMMIT_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale: 0.95 + 0.05 * progress }, { translateY: 14 - 14 * progress }],
      opacity: 0.9 + 0.1 * progress,
    };
  });

  const winToast = win ? (
    <WinToast
      key={win.key}
      direction={win.direction}
      title={
        win.direction === 'left'
          ? 'Passed'
          : win.direction === 'up'
            ? (upWin?.title ?? 'Saved')
            : (rightWin?.title ?? 'On it')
      }
      caption={win.direction === 'right' ? rightWin?.caption : win.direction === 'up' ? upWin?.caption : undefined}
    />
  ) : null;

  // The last card's win still needs a stage after the deck empties, so the
  // overlay outlives the cards.
  if (!top) return <View style={{ flex: 1 }}>{winToast}</View>;

  // The non-gesture path. Named actions surface in the VoiceOver rotor, in
  // Switch Control's action menu, and to Voice Control ("tap Apply"), so every
  // swipe this deck supports can also be performed without dragging.
  const a11yActions = [
    ...(rightActionLabel ? [{ name: 'right', label: rightActionLabel }] : []),
    ...(leftActionLabel ? [{ name: 'left', label: leftActionLabel }] : []),
    ...(allowUp && upActionLabel ? [{ name: 'up', label: upActionLabel }] : []),
    { name: 'activate', label: 'Show details' },
  ];

  const onA11yAction = (event: { nativeEvent: { actionName: string } }) => {
    switch (event.nativeEvent.actionName) {
      case 'right':
        // Honors the same wall the gesture does, so an unaffordable or blocked
        // action explains itself here too instead of silently doing nothing.
        if (blockRight) onBlockedRight?.();
        else flyOut('right');
        break;
      case 'left':
        flyOut('left');
        break;
      case 'up':
        if (!allowUp) break;
        if (upAction === 'expand') onToggleExpand(true);
        else flyUp();
        break;
      case 'activate':
        onToggleExpand(true);
        break;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {next && !expanded ? (
        <Animated.View
          key={keyOf(next)}
          style={[{ position: 'absolute', top: 10, left: 0, right: 0, bottom: 10 }, nextStyle]}>
          <Card elevated="md" padded style={[{ flex: 1, borderRadius: 22, overflow: 'hidden' }, cardBg]}>
            {renderCard(next, false, () => onToggleExpand(false))}
          </Card>
        </Animated.View>
      ) : null}

      <MaybeGestureDetector gesture={gesture}>
        <Animated.View
          key={keyOf(top)}
          {...webPan}
          accessible
          accessibilityRole="button"
          accessibilityLabel={a11yLabel ? a11yLabel(top) : undefined}
          accessibilityHint="Use the actions rotor to choose what to do with this card"
          accessibilityActions={a11yActions}
          onAccessibilityAction={onA11yAction}
          style={[{ flex: 1, paddingVertical: 10 }, topStyle]}>
          <Card
            elevated="lg"
            padded
            style={[{ flex: 1, borderRadius: 22, overflow: 'hidden' }, cardBg]}>
            {renderCard(top, expanded, () => onToggleExpand(false))}
          </Card>
          {undo?.visible && !expanded ? (
            <Pressable
              onPress={undo.onPress}
              accessibilityRole="button"
              accessibilityLabel="Bring back the last card you passed"
              hitSlop={8}
              style={{
                position: 'absolute',
                ...(undo.position === 'bottom-right' ? { bottom: 22 } : { top: 22 }),
                right: 14,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.paper,
                borderWidth: 1,
                borderColor: colors.hairline,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000000',
                shadowOpacity: 0.16,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
                elevation: 5,
                zIndex: 30,
              }}>
              <Ionicons name="arrow-undo" size={17} color={colors.ink} />
            </Pressable>
          ) : null}
          <Animated.View
            style={[{ position: 'absolute', top: 10, left: 0, right: 0 }, rightStampStyle]}
            pointerEvents="none">
            <Stamp spec={rightStamp} />
          </Animated.View>
          <Animated.View
            style={[{ position: 'absolute', top: 10, left: 0, right: 0 }, leftStampStyle]}
            pointerEvents="none">
            <Stamp spec={leftStamp} />
          </Animated.View>
          {allowUp && upStamp ? (
            <Animated.View
              style={[{ position: 'absolute', top: 10, left: 0, right: 0 }, upStampStyle]}
              pointerEvents="none">
              <Stamp spec={upStamp} />
            </Animated.View>
          ) : null}
        </Animated.View>
      </MaybeGestureDetector>
      {winToast}
    </View>
  );
}

/** forwardRef loses the generic, so re-assert it on the exported symbol. */
export const SwipeStack = forwardRef(SwipeStackInner) as <T>(
  props: SwipeStackProps<T> & { ref?: React.Ref<SwipeStackHandle> },
) => React.ReactElement | null;

export default SwipeStack;
