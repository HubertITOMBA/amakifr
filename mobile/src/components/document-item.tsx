import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DocumentDto } from "@/api/types";
import {
  documentTypeLabel,
  documentVisibilityBadge,
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
  onDelete?: (document: DocumentDto) => void;
  onRequestDelete?: (document: DocumentDto) => void;
  deleting?: boolean;
};

/**
 * Carte document adhérent — Ouvrir / Supprimer / Demander suppression.
 */
export function DocumentItem({
  document,
  onOpen,
  onDelete,
  onRequestDelete,
  deleting,
}: Props) {
  const typeLabel = documentTypeLabel(document.type);
  const visibility = documentVisibilityBadge(
    document.statutValidation,
    document.estPublic
  );
  const pendingDeletion = document.deletionRequestStatus === "EnAttente";

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
      <View style={styles.badgeRow}>
        <StatusBadge label={visibility.label} tone={visibility.tone} />
      </View>
      {pendingDeletion ? (
        <Text style={styles.pendingDelete}>Suppression demandée</Text>
      ) : null}
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
      <View style={styles.actions}>
        <Pressable
          onPress={() => onOpen(document)}
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir ${document.nomOriginal}`}
          style={styles.actionBtn}
          hitSlop={8}
        >
          <Text style={styles.openText}>Ouvrir</Text>
        </Pressable>
        {document.canDelete && onDelete ? (
          <Pressable
            onPress={() => onDelete(document)}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel={`Supprimer ${document.nomOriginal}`}
            style={[styles.actionBtn, styles.deleteBtn]}
            hitSlop={8}
          >
            <Text style={styles.deleteText}>
              {deleting ? "…" : "Supprimer"}
            </Text>
          </Pressable>
        ) : null}
        {document.canRequestDelete && onRequestDelete && !pendingDeletion ? (
          <Pressable
            onPress={() => onRequestDelete(document)}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel={`Demander la suppression de ${document.nomOriginal}`}
            style={[styles.actionBtn, styles.deleteBtn]}
            hitSlop={8}
          >
            <Text style={styles.requestText}>Demander la suppression</Text>
          </Pressable>
        ) : null}
      </View>
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
  badgeRow: {
    flexDirection: "row",
    marginBottom: AmakiSpacing.xs,
  },
  pendingDelete: {
    ...AmakiTypography.caption,
    color: AmakiColors.warning,
    fontWeight: "700",
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
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: 1,
    borderTopColor: AmakiColors.border,
    marginTop: AmakiSpacing.sm,
  },
  actionBtn: {
    flexGrow: 1,
    paddingVertical: AmakiSpacing.md,
    minHeight: 44,
    minWidth: "40%",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    borderLeftWidth: 1,
    borderLeftColor: AmakiColors.border,
  },
  openText: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    fontWeight: "700",
  },
  deleteText: {
    ...AmakiTypography.caption,
    color: AmakiColors.danger,
    fontWeight: "700",
  },
  requestText: {
    ...AmakiTypography.caption,
    color: AmakiColors.warning,
    fontWeight: "700",
    textAlign: "center",
  },
});
