import { StyleSheet, Text, View } from "react-native";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Props = {
  message: string;
};

/**
 * Bandeau d'erreur non bloquant.
 */
export function ErrorBanner({ message }: Props) {
  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: AmakiColors.dangerSoft,
    borderRadius: AmakiRadius.sm,
    borderWidth: 1,
    borderColor: AmakiColors.dangerBorder,
    paddingHorizontal: AmakiSpacing.md,
    paddingVertical: AmakiSpacing.sm,
    marginHorizontal: AmakiSpacing.lg,
    marginTop: AmakiSpacing.sm,
  },
  text: {
    ...AmakiTypography.caption,
    color: AmakiColors.danger,
    fontWeight: "600",
  },
});
