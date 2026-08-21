import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  deleteMyDocument,
  getMyDocuments,
  openMyDocumentFile,
  requestMyDocumentDeletion,
  uploadMyDocument,
} from "@/api/documents";
import {
  documentErrorMessage,
  validateDocumentSelection,
} from "@/api/documents-state";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { mapDocumentPickerAssetToFilePart, mapImagePickerAssetToFilePart } from "@/api/react-native-form-data-file";
import { ApiClientError, type DocumentDto } from "@/api/types";
import { DocumentItem } from "@/components/document-item";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Écran Mes documents — liste + upload PDF/photo + suppression.
 */
export default function DocumentsScreen() {
  const [items, setItems] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);
  const guardRef = useRef<LoadGuard>(createLoadGuard());

  const load = useCallback(async (isRefresh = false) => {
    const started = beginLoad(guardRef.current);
    guardRef.current = started.guard;
    const gen = started.gen;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const list = await getMyDocuments();
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      setItems(list);
    } catch (e) {
      if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
      if (e instanceof ApiClientError) {
        setError(documentErrorMessage(e));
      } else {
        setError("Impossible de charger les documents");
      }
    } finally {
      const ended = endLoad(guardRef.current);
      guardRef.current = ended.guard;
      if (ended.clearSpinners) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  async function onOpen(document: DocumentDto) {
    const result = await openMyDocumentFile(document);
    if (result === "failed") {
      Alert.alert(
        "Ouverture impossible",
        "Le document n'a pas pu être téléchargé."
      );
    } else if (result === "unavailable") {
      Alert.alert(
        "Partage indisponible",
        "Impossible d'ouvrir le fichier sur cet appareil."
      );
    }
  }

  function onDelete(document: DocumentDto) {
    Alert.alert("Supprimer ce document ?", document.nomOriginal, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setDeletingId(document.id);
            try {
              await deleteMyDocument(document.id);
              setItems((prev) => prev.filter((d) => d.id !== document.id));
            } catch (e) {
              Alert.alert(
                "Suppression impossible",
                e instanceof ApiClientError
                  ? documentErrorMessage(e)
                  : "Erreur lors de la suppression"
              );
            } finally {
              setDeletingId(null);
            }
          })();
        },
      },
    ]);
  }

  function onRequestDelete(document: DocumentDto) {
    Alert.alert(
      "Demander la suppression de ce document ?",
      "Le document est validé et public. Un administrateur traitera votre demande. Ceci n'est pas une demande de suppression de compte.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Demander",
          onPress: () => {
            void (async () => {
              setDeletingId(document.id);
              try {
                await requestMyDocumentDeletion(document.id);
                setItems((prev) =>
                  prev.map((d) =>
                    d.id === document.id
                      ? {
                          ...d,
                          canRequestDelete: false,
                          deletionRequestStatus: "EnAttente",
                        }
                      : d
                  )
                );
              } catch (e) {
                Alert.alert(
                  "Demande impossible",
                  e instanceof ApiClientError
                    ? documentErrorMessage(e)
                    : "Erreur lors de la demande"
                );
              } finally {
                setDeletingId(null);
              }
            })();
          },
        },
      ]
    );
  }

  function openUploadSheet() {
    setDescription("");
    setPendingFile(null);
    setUploadOpen(true);
  }

  async function pickPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const part = mapDocumentPickerAssetToFilePart(result.assets[0]);
      const check = validateDocumentSelection({
        mimeType: part.type,
        size: result.assets[0].size,
      });
      if (!check.ok) {
        Alert.alert("Fichier refusé", check.message);
        return;
      }
      setPendingFile({ uri: part.uri, name: part.name, mimeType: part.type });
    } catch {
      Alert.alert("Erreur", "Impossible de sélectionner le PDF");
    }
  }

  async function pickPhoto() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission requise",
          "Autorisez l'accès à la galerie pour choisir une photo."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const part = mapImagePickerAssetToFilePart(asset);
      const check = validateDocumentSelection({
        mimeType: part.type,
        size: asset.fileSize,
      });
      if (!check.ok) {
        Alert.alert("Fichier refusé", check.message);
        return;
      }
      setPendingFile({ uri: part.uri, name: part.name, mimeType: part.type });
    } catch {
      Alert.alert("Erreur", "Impossible de sélectionner la photo");
    }
  }

  async function submitUpload() {
    if (!pendingFile) {
      Alert.alert("Fichier manquant", "Choisissez un PDF ou une photo.");
      return;
    }
    setUploading(true);
    try {
      const created = await uploadMyDocument({
        uri: pendingFile.uri,
        name: pendingFile.name,
        mimeType: pendingFile.mimeType,
        description,
      });
      setItems((prev) => [created, ...prev]);
      setUploadOpen(false);
      setPendingFile(null);
      setDescription("");
    } catch (e) {
      Alert.alert(
        "Upload impossible",
        e instanceof ApiClientError
          ? documentErrorMessage(e)
          : "Erreur lors de l'envoi"
      );
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <View style={styles.root}>
      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.toolbar}>
        <SecondaryButton
          label="Ajouter un document"
          onPress={openUploadSheet}
          style={styles.addBtn}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          items.length === 0 ? styles.emptyContainer : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={AmakiColors.primary}
          />
        }
        ListEmptyComponent={
          error ? null : (
            <EmptyState title="Aucun document" />
          )
        }
        renderItem={({ item }) => (
          <DocumentItem
            document={item}
            onOpen={onOpen}
            onDelete={onDelete}
            onRequestDelete={onRequestDelete}
            deleting={deletingId === item.id}
          />
        )}
      />

      <Modal
        visible={uploadOpen}
        animationType="slide"
        transparent
        onRequestClose={() => !uploading && setUploadOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ajouter un document</Text>
            <Text style={styles.modalHint}>
              PDF ou photo uniquement. Publication admin via le Web.
            </Text>

            <View style={styles.pickRow}>
              <SecondaryButton
                label="PDF"
                onPress={() => void pickPdf()}
                disabled={uploading}
                style={styles.pickBtn}
              />
              <SecondaryButton
                label="Photo"
                onPress={() => void pickPhoto()}
                disabled={uploading}
                style={styles.pickBtn}
              />
            </View>

            {pendingFile ? (
              <Text style={styles.fileName} numberOfLines={2}>
                {pendingFile.name}
              </Text>
            ) : (
              <Text style={styles.filePlaceholder}>Aucun fichier choisi</Text>
            )}

            <Text style={styles.fieldLabel}>Description (optionnel)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Libellé / description"
              placeholderTextColor={AmakiColors.textMuted}
              style={styles.input}
              editable={!uploading}
              maxLength={500}
            />

            <SecondaryButton
              label={uploading ? "Envoi…" : "Envoyer"}
              onPress={() => void submitUpload()}
              disabled={uploading || !pendingFile}
              loading={uploading}
              style={styles.submitBtn}
            />
            <Pressable
              onPress={() => !uploading && setUploadOpen(false)}
              style={styles.cancelBtn}
              disabled={uploading}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  toolbar: {
    paddingHorizontal: AmakiSpacing.lg,
    paddingTop: AmakiSpacing.md,
    paddingBottom: AmakiSpacing.sm,
  },
  addBtn: { alignSelf: "stretch" },
  list: {
    padding: AmakiSpacing.lg,
    paddingTop: AmakiSpacing.sm,
    paddingBottom: AmakiSpacing["2xl"],
  },
  emptyContainer: {
    flexGrow: 1,
    padding: AmakiSpacing.lg,
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: AmakiColors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: AmakiSpacing.lg,
    paddingBottom: AmakiSpacing["2xl"],
  },
  modalTitle: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.xs,
  },
  modalHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.md,
  },
  pickRow: { flexDirection: "row", gap: AmakiSpacing.sm },
  pickBtn: { flex: 1 },
  fileName: {
    ...AmakiTypography.caption,
    color: AmakiColors.text,
    fontWeight: "600",
    marginTop: AmakiSpacing.md,
  },
  filePlaceholder: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.md,
  },
  fieldLabel: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginTop: AmakiSpacing.md,
    marginBottom: 4,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: 8,
    padding: AmakiSpacing.sm,
    color: AmakiColors.text,
    ...AmakiTypography.body,
    minHeight: 44,
  },
  submitBtn: { marginTop: AmakiSpacing.lg, alignSelf: "stretch" },
  cancelBtn: {
    marginTop: AmakiSpacing.md,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  cancelText: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    fontWeight: "600",
  },
});
