import { StyleSheet, Text, View } from "react-native";
import type { CotisationMensuelleDto } from "@/api/types";
import { mapCotisationStatut } from "@/api/cotisation-display";
import { formatIsoDate } from "@/api/cotisations-state";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoneyDecimalString } from "@/utils/money";
import { isZeroDecimalString } from "@/utils/decimal-string";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Props = {
  cotisation: CotisationMensuelleDto;
};

/**
 * Carte lecture seule d'une cotisation mensuelle.
 */
export function CotisationItem({ cotisation }: Props) {
  const type = cotisation.typeCotisation;
  const statut = mapCotisationStatut(cotisation.statut);
  const restantNonNul = !isZeroDecimalString(cotisation.montantRestant);

  const metaParts: string[] = [type.categorie];
  if (type.obligatoire) {
    metaParts.push("Obligatoire");
  }

  return (
    <Card
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`Cotisation ${type.nom}, période ${cotisation.periode}, statut ${statut.label}`}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{type.nom}</Text>
        <StatusBadge label={statut.label} tone={statut.tone} />
      </View>
      <Text style={styles.meta}>{metaParts.join(" · ")}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Période</Text>
        <Text style={styles.value}>{cotisation.periode}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Échéance</Text>
        <Text style={styles.value}>
          {formatIsoDate(cotisation.dateEcheance)}
        </Text>
      </View>

      <View style={styles.amounts}>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Attendu</Text>
          <Text style={styles.amountValue}>
            {formatMoneyDecimalString(cotisation.montantAttendu)}
          </Text>
        </View>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Payé</Text>
          <Text style={styles.amountValue}>
            {formatMoneyDecimalString(cotisation.montantPaye)}
          </Text>
        </View>
        <View
          style={[
            styles.amountBlock,
            restantNonNul && styles.restantHighlight,
          ]}
        >
          <Text style={styles.amountLabel}>Restant</Text>
          <Text
            style={[
              styles.amountValue,
              restantNonNul && styles.restantValue,
            ]}
          >
            {formatMoneyDecimalString(cotisation.montantRestant)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: AmakiSpacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.xs,
  },
  title: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    flex: 1,
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: AmakiSpacing.xs,
  },
  label: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  value: {
    ...AmakiTypography.caption,
    fontWeight: "600",
    color: AmakiColors.text,
  },
  amounts: {
    flexDirection: "row",
    marginTop: AmakiSpacing.md,
    gap: AmakiSpacing.sm,
  },
  amountBlock: {
    flex: 1,
    backgroundColor: AmakiColors.surfaceMuted,
    borderRadius: AmakiRadius.sm,
    padding: AmakiSpacing.sm,
  },
  restantHighlight: {
    backgroundColor: AmakiColors.primarySoft,
    borderWidth: 1,
    borderColor: AmakiColors.primaryBorder,
  },
  amountLabel: {
    ...AmakiTypography.label,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.xs,
  },
  amountValue: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    color: AmakiColors.text,
  },
  restantValue: {
    color: AmakiColors.primary,
    fontSize: 14,
  },
});
