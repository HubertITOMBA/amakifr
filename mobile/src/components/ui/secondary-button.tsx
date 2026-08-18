import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Props = Omit<PressableProps, "children" | "style"> & {
  label: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Bouton secondaire (outline / texte).
 */
export function SecondaryButton({
  label,
  loading,
  disabled,
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      style={[styles.button, isDisabled && styles.disabled, style]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={AmakiColors.primary} size="small" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: AmakiRadius.sm,
    borderWidth: 1,
    borderColor: AmakiColors.primary,
    paddingVertical: AmakiSpacing.sm,
    paddingHorizontal: AmakiSpacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AmakiColors.surface,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    color: AmakiColors.primary,
  },
});
