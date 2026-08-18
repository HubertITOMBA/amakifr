import { StyleSheet, View, type ViewProps } from "react-native";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
} from "@/constants/theme";

type Props = ViewProps & {
  muted?: boolean;
};

/**
 * Surface carte AMAKI — bordure + fond surface.
 */
export function Card({ style, muted, children, ...rest }: Props) {
  return (
    <View
      style={[
        styles.card,
        muted && styles.muted,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AmakiColors.surface,
    borderRadius: AmakiRadius.md,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    padding: AmakiSpacing.md,
  },
  muted: {
    backgroundColor: AmakiColors.surfaceMuted,
  },
});
