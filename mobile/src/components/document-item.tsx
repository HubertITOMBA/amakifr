import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DocumentDto } from "@/api/types";
import {
  documentCardDescription,
  documentCardTitle,
  documentPublicationBadge,
  documentValidationBadge,
  formatFileSize,
} from "@/api/documents-state";
import {
  DocumentCardPastel,
  documentCardPastelAccent,
  documentPublicationPastelBadge,
  documentValidationPastelBadge,
} from "@/api/documents-card-pastel";
import { formatDateTimeFr } from "@/utils/profile-helpers";
import { Card } from "@/components/ui/card";
import {
  AmakiColors,
  AmakiRadius,
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

type PastelBadgeProps = {
  label: string;
  bg: string;
  text: string;
  border: string;
};

function PastelBadge({ label, bg, text, border }: PastelBadgeProps) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: border },
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

/**
 * Carte document adhérent — palette pastel locale (sans thème global).
 */
export function DocumentItem({
  document,
  onOpen,
  onDelete,
  onRequestDelete,
  deleting,
}: Props) {
  const title = documentCardTitle(document.type);
  const description = documentCardDescription(document.description);
  const validation = documentValidationBadge(document.statutValidation);
  const publication = documentPublicationBadge(document.estPublic);
  const accent = documentCardPastelAccent(document.statutValidation);
  const validationColors = documentValidationPastelBadge(
    document.statutValidation
  );
  const publicationColors = documentPublicationPastelBadge(document.estPublic);
  const pendingDeletion = document.deletionRequestStatus === "EnAttente";
  const a11yTitle = description ? `${title}, ${description}` : title;

  return (
    <Card
      style={[
        styles.card,
        {
          borderLeftColor: accent.borderLeft,
          backgroundColor: accent.cardBg,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Document ${a11yTitle}`}
    >
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {description ? (
        <Text style={styles.description} numberOfLines={3}>
          {description}
        </Text>
      ) : null}
      <View style={styles.badgeRow}>
        <PastelBadge
          label={validation.label}
          bg={validationColors.bg}
          text={validationColors.text}
          border={validationColors.border}
        />
        <PastelBadge
          label={publication.label}
          bg={publicationColors.bg}
          text={publicationColors.text}
          border={publicationColors.border}
        />
      </View>
      {pendingDeletion ? (
        <Text style={styles.pendingDelete}>Suppression demandée</Text>
      ) : null}
      <View style={styles.row}>
        <Text style={styles.label}>Taille</Text>
        <Text style={styles.value}>{formatFileSize(document.taille)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Ajouté le</Text>
        <Text style={styles.value}>{formatDateTimeFr(document.createdAt)}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onOpen(document)}
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir ${a11yTitle}`}
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
            accessibilityLabel={`Supprimer ${a11yTitle}`}
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
            accessibilityLabel={`Demander la suppression de ${a11yTitle}`}
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
    borderLeftWidth: 3,
    overflow: "hidden",
  },
  title: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  description: {
    ...AmakiTypography.body,
    color: AmakiColors.textSecondary,
    marginBottom: AmakiSpacing.sm,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: AmakiSpacing.xs,
    marginBottom: AmakiSpacing.sm,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: AmakiRadius.pill,
    borderWidth: 1,
    paddingHorizontal: AmakiSpacing.sm,
    paddingVertical: AmakiSpacing.xs,
  },
  badgeText: {
    ...AmakiTypography.caption,
    fontWeight: "700",
  },
  pendingDelete: {
    ...AmakiTypography.caption,
    color: DocumentCardPastel.waiting.badgeText,
    fontWeight: "700",
    marginBottom: AmakiSpacing.xs,
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
