import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { declareBankOrWeroPayment } from "@/api/payment-account";
import {
  buildClientPaymentReference,
  buildVirementModalContent,
  buildWeroModalContent,
  canDeclarePartialAmount,
  DECLARE_OVERPAYMENT_HINT,
  declarePaymentErrorMessage,
  formatIbanDisplay,
  isDeclaredAmountOverRestant,
  isWeroAvailable,
  validateJustificatifSelection,
  WERO_PAYMENT_HINT,
  type ActivePaymentAccountDto,
  type JustificatifSelection,
  type PayableTargetType,
} from "@/api/payment-account-state";
import {
  mapDocumentPickerAssetToFilePart,
  mapImagePickerAssetToFilePart,
} from "@/api/react-native-form-data-file";
import { ApiClientError } from "@/api/types";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { formatMoneyDecimalString } from "@/utils/money";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

export type PaymentTarget = {
  targetType: PayableTargetType;
  targetId: string;
  label: string;
  restant: string;
};

export type PaymentMethodChoice = "Wero" | "Virement";

type Step = "pick-target" | "coords" | "declare";

type Props = {
  visible: boolean;
  account: ActivePaymentAccountDto;
  /** Méthode imposée par le bouton de la carte Paiement. */
  method: PaymentMethodChoice;
  /** Cible pré-sélectionnée (ligne) ou null → choix dans le modal. */
  target: PaymentTarget | null;
  /** Lignes payables si aucune cible pré-sélectionnée. */
  payableTargets: PaymentTarget[];
  onClose: () => void;
  onSuccess: (message: string) => void;
};

/**
 * Modal paiement en 2 temps : coordonnées → justificatif / déclaration.
 */
export function DeclarePaymentModal({
  visible,
  account,
  method,
  target: initialTarget,
  payableTargets,
  onClose,
  onSuccess,
}: Props) {
  const weroOk = isWeroAvailable(account);
  const [selected, setSelected] = useState<PaymentTarget | null>(null);
  const [step, setStep] = useState<Step>("coords");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<JustificatifSelection | null>(null);
  const [copiedHint, setCopiedHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const startTarget =
      initialTarget ??
      (payableTargets.length === 1 ? payableTargets[0] : null);
    setSelected(startTarget);
    setStep(startTarget ? "coords" : "pick-target");
    setAmount(startTarget ? startTarget.restant.replace(",", ".") : "");
    setReference(
      startTarget
        ? buildClientPaymentReference(startTarget.targetType)
        : ""
    );
    setFile(null);
    setLocalError(null);
    setCopiedHint(null);
    setSubmitting(false);
  }, [visible, initialTarget, payableTargets, method]);

  const target = selected;

  const copy = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setCopiedHint("Copié");
      setTimeout(() => setCopiedHint(null), 1500);
    } catch {
      Alert.alert("Copie impossible");
    }
  };

  const pickTarget = (t: PaymentTarget) => {
    setSelected(t);
    setAmount(t.restant.replace(",", "."));
    setReference(buildClientPaymentReference(t.targetType));
    setStep("coords");
    setLocalError(null);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Autorisation requise", "Accès à la galerie nécessaire.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const part = mapImagePickerAssetToFilePart({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
    });
    setFile({
      uri: part.uri,
      name: part.name,
      mime: part.type,
      size: asset.fileSize ?? null,
    });
    setLocalError(null);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const part = mapDocumentPickerAssetToFilePart({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
    });
    setFile({
      uri: part.uri,
      name: part.name,
      mime: part.type,
      size: asset.size ?? null,
    });
    setLocalError(null);
  };

  const goToDeclare = () => {
    if (!target) return;
    const amountCheck = canDeclarePartialAmount(amount, target.restant);
    if (!amountCheck.ok) {
      setLocalError(amountCheck.error ?? "Montant invalide");
      return;
    }
    if (method === "Wero" && !weroOk) {
      setLocalError("Wero n'est pas disponible actuellement");
      return;
    }
    setLocalError(null);
    setStep("declare");
  };

  const submit = async () => {
    if (!target) return;
    setLocalError(null);
    const amountCheck = canDeclarePartialAmount(amount, target.restant);
    if (!amountCheck.ok) {
      setLocalError(amountCheck.error ?? "Montant invalide");
      return;
    }
    if (method === "Wero" && !weroOk) {
      setLocalError("Wero n'est pas disponible actuellement");
      return;
    }
    const fileCheck = validateJustificatifSelection(file);
    if (!fileCheck.ok) {
      setLocalError(fileCheck.error);
      return;
    }
    if (!file) return;

    setSubmitting(true);
    try {
      const result = await declareBankOrWeroPayment({
        targetType: target.targetType,
        targetId: target.targetId,
        amount: String(amount).replace(",", "."),
        paymentMethod: method,
        justificatifUri: file.uri,
        justificatifName: file.name,
        justificatifMime: file.mime,
        justificatifSize: file.size,
      });
      onSuccess(
        result.message ||
          "Votre paiement a été enregistré et sera vérifié par l'association."
      );
      onClose();
    } catch (e) {
      const message =
        e instanceof ApiClientError
          ? declarePaymentErrorMessage(e)
          : "Impossible d'enregistrer le paiement";
      setLocalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    method === "Wero" ? "Payer avec Wero" : "Déclarer un virement";

  const weroContent =
    method === "Wero" && target
      ? buildWeroModalContent(account, reference, amount)
      : null;
  const virementContent =
    method === "Virement" && target
      ? buildVirementModalContent(account, reference, amount)
      : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={styles.close}>Fermer</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {step === "pick-target" ? (
            <>
              <Text style={styles.label}>Choisir une ligne à régler</Text>
              {payableTargets.length === 0 ? (
                <Text style={styles.error}>
                  Aucune ligne avec un restant dû pour cette année.
                </Text>
              ) : (
                payableTargets.map((t) => (
                  <Pressable
                    key={`${t.targetType}-${t.targetId}`}
                    style={styles.targetRow}
                    onPress={() => pickTarget(t)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.targetLabel}>{t.label}</Text>
                    <Text style={styles.meta}>
                      Restant : {formatMoneyDecimalString(t.restant)}
                    </Text>
                  </Pressable>
                ))
              )}
            </>
          ) : null}

          {step === "coords" && target ? (
            <>
              <Text style={styles.label}>{target.label}</Text>
              <Text style={styles.meta}>
                Restant dû : {formatMoneyDecimalString(target.restant)}
              </Text>

              <Text style={styles.fieldLabel}>Montant</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="Montant"
                accessibilityLabel="Montant à payer"
              />
              {isDeclaredAmountOverRestant(amount, target.restant) ? (
                <Text style={styles.hint}>{DECLARE_OVERPAYMENT_HINT}</Text>
              ) : null}

              {method === "Wero" && weroContent ? (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>Paiement Wero</Text>
                  <Text style={styles.meta}>
                    Montant :{" "}
                    {formatMoneyDecimalString(weroContent.amount || "0")}
                  </Text>
                  <Text style={styles.mono}>{weroContent.phone}</Text>
                  <Text style={styles.mono}>Réf. {weroContent.reference}</Text>
                  <View style={styles.copyRow}>
                    <SecondaryButton
                      label="Copier le téléphone"
                      onPress={() => void copy(weroContent.phone)}
                    />
                    <SecondaryButton
                      label="Copier la référence"
                      onPress={() => void copy(weroContent.reference)}
                    />
                  </View>
                  <Text style={styles.hint}>{WERO_PAYMENT_HINT}</Text>
                </View>
              ) : null}

              {method === "Virement" && virementContent ? (
                <View style={styles.block}>
                  <Text style={styles.blockTitle}>Virement</Text>
                  <Text style={styles.meta}>
                    Montant :{" "}
                    {formatMoneyDecimalString(virementContent.amount || "0")}
                  </Text>
                  <Text style={styles.meta}>
                    Titulaire : {virementContent.titulaire}
                  </Text>
                  <Text style={styles.mono}>
                    IBAN : {formatIbanDisplay(virementContent.iban)}
                  </Text>
                  <Text style={styles.mono}>BIC : {virementContent.bic}</Text>
                  <Text style={styles.mono}>
                    Réf. {virementContent.reference}
                  </Text>
                  <View style={styles.copyRow}>
                    <SecondaryButton
                      label="Copier l'IBAN"
                      onPress={() => void copy(virementContent.iban)}
                    />
                    <SecondaryButton
                      label="Copier le BIC"
                      onPress={() => void copy(virementContent.bic)}
                    />
                    <SecondaryButton
                      label="Copier la référence"
                      onPress={() => void copy(virementContent.reference)}
                    />
                  </View>
                </View>
              ) : null}

              {copiedHint ? (
                <Text style={styles.copied}>{copiedHint}</Text>
              ) : null}
              {localError ? <Text style={styles.error}>{localError}</Text> : null}

              <Pressable
                style={styles.submit}
                onPress={goToDeclare}
                accessibilityRole="button"
              >
                <Text style={styles.submitText}>
                  {method === "Wero"
                    ? "J'ai effectué le paiement"
                    : "J'ai effectué le virement"}
                </Text>
              </Pressable>
            </>
          ) : null}

          {step === "declare" && target ? (
            <>
              <Text style={styles.label}>{target.label}</Text>
              <Text style={styles.meta}>
                Montant : {formatMoneyDecimalString(amount)} · {method}
              </Text>
              <Text style={styles.fieldLabel}>
                Justificatif (PDF ou image, max 10 Mo)
              </Text>
              <View style={styles.copyRow}>
                <SecondaryButton
                  label="Galerie"
                  onPress={() => void pickImage()}
                />
                <SecondaryButton
                  label="PDF / fichier"
                  onPress={() => void pickDocument()}
                />
              </View>
              {file ? (
                <Text style={styles.meta}>Fichier : {file.name}</Text>
              ) : (
                <Text style={styles.hint}>Aucun fichier sélectionné</Text>
              )}
              {localError ? (
                <Text style={styles.error}>{localError}</Text>
              ) : null}
              <Pressable
                style={[styles.submit, submitting && styles.submitDisabled]}
                onPress={() => void submit()}
                disabled={submitting}
                accessibilityRole="button"
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Déclarer le paiement</Text>
                )}
              </Pressable>
              <SecondaryButton
                label="Retour"
                onPress={() => setStep("coords")}
                style={{ marginTop: AmakiSpacing.sm }}
              />
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AmakiColors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: AmakiSpacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AmakiColors.border,
  },
  title: { ...AmakiTypography.heading, color: AmakiColors.text, flex: 1 },
  close: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    fontWeight: "700",
  },
  body: { padding: AmakiSpacing.lg, paddingBottom: AmakiSpacing["2xl"] },
  label: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "700",
  },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginTop: 4,
  },
  fieldLabel: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    fontWeight: "700",
    marginTop: AmakiSpacing.md,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.sm,
    paddingHorizontal: AmakiSpacing.sm,
    paddingVertical: AmakiSpacing.sm,
    backgroundColor: AmakiColors.surface,
    color: AmakiColors.text,
    ...AmakiTypography.body,
  },
  block: {
    marginTop: AmakiSpacing.md,
    padding: AmakiSpacing.md,
    borderRadius: AmakiRadius.sm,
    borderWidth: 1,
    borderColor: AmakiColors.primaryBorder,
    backgroundColor: AmakiColors.surface,
  },
  blockTitle: {
    ...AmakiTypography.body,
    fontWeight: "700",
    color: AmakiColors.text,
    marginBottom: 4,
  },
  mono: {
    ...AmakiTypography.caption,
    color: AmakiColors.text,
    fontFamily: "monospace",
    marginTop: 4,
  },
  copyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: AmakiSpacing.sm,
    marginTop: AmakiSpacing.sm,
  },
  hint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.sm,
  },
  copied: {
    ...AmakiTypography.caption,
    color: AmakiColors.primaryStrong,
    fontWeight: "700",
    marginTop: AmakiSpacing.sm,
  },
  error: {
    ...AmakiTypography.caption,
    color: AmakiColors.danger,
    marginTop: AmakiSpacing.sm,
  },
  submit: {
    marginTop: AmakiSpacing.lg,
    backgroundColor: AmakiColors.primary,
    borderRadius: AmakiRadius.sm,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: AmakiSpacing.md,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: {
    ...AmakiTypography.body,
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },
  targetRow: {
    marginTop: AmakiSpacing.sm,
    padding: AmakiSpacing.md,
    borderRadius: AmakiRadius.sm,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    backgroundColor: AmakiColors.surface,
  },
  targetLabel: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "600",
  },
});
