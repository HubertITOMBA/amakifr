import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import amakiLogo from "@/assets/images/amaki-logo-full.png";
import { AMAKI_BRAND_LOGO_SIZE } from "@/features/auth/sign-in-model";
import { formatHomeGreeting } from "@/features/home/home-model";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Props = {
  name?: string | null;
  role?: string | null;
  status?: string | null;
};

/**
 * Grande carte logo flottante — proportions proches de la référence.
 */
export function WelcomeCard({ name, role, status }: Props) {
  const greeting = formatHomeGreeting(name);
  const roleLabel = role?.trim() || "—";
  const statusLabel = status?.trim() || "—";

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Image
        source={amakiLogo}
        style={styles.logo}
        accessibilityLabel="AMAKI France"
        alt="AMAKI France"
        contentFit="contain"
      />
      <Text style={styles.greeting}>{greeting}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{roleLabel}</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.meta}>{statusLabel}</Text>
      </View>
      <Text style={styles.member}>Membre AMAKI France</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    backgroundColor: AmakiColors.surface,
    borderRadius: AmakiRadius.lg,
    paddingTop: AmakiSpacing.sm,
    paddingBottom: AmakiSpacing.lg,
    paddingHorizontal: AmakiSpacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: AmakiColors.border,
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    /** Android : supérieur au header (elevation 0). */
    elevation: 12,
    zIndex: 10,
  },
  logo: {
    width: AMAKI_BRAND_LOGO_SIZE,
    height: AMAKI_BRAND_LOGO_SIZE,
    marginBottom: AmakiSpacing.sm,
  },
  greeting: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: AmakiSpacing.xs,
    marginTop: AmakiSpacing.sm,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    fontWeight: "600",
  },
  dot: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  member: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.xs,
    textAlign: "center",
  },
});
