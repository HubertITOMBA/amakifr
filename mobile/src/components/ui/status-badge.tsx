import { StyleSheet, Text, View } from "react-native";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";
import type { CotisationStatusTone } from "@/api/cotisation-display";
import { badgeDisplayLabel } from "@/components/ui/status-badge-label";

type Tone = CotisationStatusTone;

type Props = {
  label: string;
  tone?: Tone;
};

const TONE_STYLES: Record<
  Tone,
  { bg: string; text: string; border: string }
> = {
  success: {
    bg: AmakiColors.successSoft,
    text: AmakiColors.success,
    border: "#bbf7d0",
  },
  primary: {
    bg: AmakiColors.primarySoft,
    text: AmakiColors.primary,
    border: AmakiColors.primaryBorder,
  },
  warning: {
    bg: AmakiColors.warningSoft,
    text: AmakiColors.warning,
    border: "#fed7aa",
  },
  danger: {
    bg: AmakiColors.dangerSoft,
    text: AmakiColors.danger,
    border: AmakiColors.dangerBorder,
  },
  neutral: {
    bg: AmakiColors.surfaceMuted,
    text: AmakiColors.textMuted,
    border: AmakiColors.border,
  },
};

/**
 * Badge de statut texte + couleur (pas uniquement couleur).
 * Largeur intrinsèque au contenu — ne doit jamais être compressé.
 */
export function StatusBadge({ label, tone = "neutral" }: Props) {
  const palette = TONE_STYLES[tone];
  const display = badgeDisplayLabel(label);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text style={[styles.text, { color: palette.text }]}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: AmakiRadius.pill,
    borderWidth: 1,
    paddingHorizontal: AmakiSpacing.sm,
    paddingVertical: AmakiSpacing.xs,
  },
  text: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    textTransform: "none",
  },
});
