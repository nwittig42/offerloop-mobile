import { View, type ViewProps } from 'react-native';

import { colors, shadows } from '@/theme/tokens';

/**
 * Web Card recipe: radius 10, hairline border, white fill, 20px padding.
 * Soft shadow only when elevated. The swipe card sits on md or lg above paper-2.
 */
type CardProps = ViewProps & {
  elevated?: 'sm' | 'md' | 'lg' | false;
  padded?: boolean;
};

export function Card({
  elevated = false,
  padded = true,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.paper,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: padded ? 20 : 0,
        },
        elevated ? shadows[elevated] : null,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

export default Card;
