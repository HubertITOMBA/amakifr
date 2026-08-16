import { StyleSheet, Text, View } from "react-native";
import type { CotisationMensuelleDto } from "@/api/types";
import { formatIsoDate } from "@/api/cotisations-state";
import { formatMoneyDecimalString } from "@/utils/money";

type Props = {
  cotisation: CotisationMensuelleDto;
};

/**
 * Carte lecture seule d'une cotisation mensuelle.
 */
export function CotisationItem({ cotisation }: Props) {
  const type = cotisation.typeCotisation;
  const metaParts: string[] = [type.categorie];
  if (type.obligatoire) {
    metaParts.push("Obligatoire");
  }

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`Cotisation ${type.nom}, période ${cotisation.periode}, statut ${cotisation.statut}`}
    >
      <Text style={styles.title}>{type.nom}</Text>
      <Text style={styles.meta}>{metaParts.join(" · ")}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Période</Text>
        <Text style={styles.value}>{cotisation.periode}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Échéance</Text>
        <Text style={styles.value}>{formatIsoDate(cotisation.dateEcheance)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Statut</Text>
        <Text style={styles.value}>{cotisation.statut}</Text>
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
        <View style={[styles.amountBlock, styles.restantBlock]}>
          <Text style={styles.amountLabel}>Restant</Text>
          <Text style={[styles.amountValue, styles.restantValue]}>
            {formatMoneyDecimalString(cotisation.montantRestant)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: "#64748b",
  },
  value: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  amounts: {
    flexDirection: "row",
    marginTop: 12,
    gap: 8,
  },
  amountBlock: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 8,
  },
  restantBlock: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  restantValue: {
    color: "#1d4ed8",
    fontSize: 14,
  },
});
