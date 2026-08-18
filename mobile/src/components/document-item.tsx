import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DocumentDto } from "@/api/types";
import {
  documentTypeLabel,
  formatFileSize,
} from "@/api/documents-state";
import { formatDateFr } from "@/utils/profile-helpers";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Props = {
  document: DocumentDto;
  onOpen: (document: DocumentDto) => void;
};

/**
 * Carte lecture seule d'un document adhérent.
 */
export function DocumentItem({ document, onOpen }: Props) {
  const typeLabel = documentTypeLabel(document.type);

  return (
    <Card
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`Document ${document.nomOriginal}, ${typeLabel}`}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {document.nomOriginal}
        </Text>
        <StatusBadge label={typeLabel} tone="primary" />
      </View>
      {document.categorie ? (
        <Text style={styles.meta}>{document.categorie}</Text>
      ) : null}
      {document.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {document.description}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Text style={styles.label}>Taille</Text>
        <Text style={styles.value}>{formatFileSize(document.taille)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Ajouté le</Text>
        <Text style={styles.value}>{formatDateFr(document.createdAt)}</Text>
      </View>
      <Pressable
        onPress={() => onOpen(document)}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir ${document.nomOriginal}`}
        style={styles.openBtn}
        hitSlop={8}
      >
        <Text style={styles.openText}>Ouvrir</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: AmakiSpacing.md,
    paddingBottom: 0,
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
    marginBottom: AmakiSpacing.xs,
  },
  description: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
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
  openBtn: {
    borderTopWidth: 1,
    borderTopColor: AmakiColors.border,
    marginTop: AmakiSpacing.sm,
    paddingVertical: AmakiSpacing.md,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  openText: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    fontWeight: "700",
  },
});
