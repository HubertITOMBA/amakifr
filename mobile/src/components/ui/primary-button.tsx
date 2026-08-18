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
  variant?: "primary" | "danger";
  style?: StyleProp<ViewStyle>;
};

/**
 * Bouton principal AMAKI.
 */
export function PrimaryButton({
  label,
  loading,
  disabled,
  variant = "primary",
  style,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      style={[
        styles.button,
        variant === "danger" && styles.danger,
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={AmakiColors.surface} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: AmakiColors.primary,
    borderRadius: AmakiRadius.sm,
    paddingVertical: AmakiSpacing.md,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: AmakiSpacing.lg,
  },
  danger: {
    backgroundColor: AmakiColors.danger,
  },
  disabled: {
    opacity: 0.65,
  },
  label: {
    ...AmakiTypography.body,
    fontWeight: "600",
    color: AmakiColors.surface,
  },
});
