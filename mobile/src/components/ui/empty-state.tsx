import { StyleSheet, Text, View } from "react-native";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Props = {
  title: string;
  message?: string;
};

/**
 * État vide centré.
 */
export function EmptyState({ title, message }: Props) {
  return (
    <View style={styles.root} accessibilityRole="text">
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    padding: AmakiSpacing.xl,
  },
  title: {
    ...AmakiTypography.heading,
    color: AmakiColors.textMuted,
    textAlign: "center",
  },
  message: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
    marginTop: AmakiSpacing.xs,
  },
});
