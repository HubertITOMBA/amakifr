import { useCallback, useState, useEffect, useMemo } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  getMyEvent,
  registerMyEvent,
  withdrawMyEvent,
} from "@/api/evenements";
import {
  evenementErrorMessage,
  eventPaymentStatusLabel,
  formatEventPeriod,
  formatEventPrix,
  formatEventTotalEstimate,
  placesLabel,
  eventStatusTone,
} from "@/api/evenements-state";
import { getActivePaymentAccount } from "@/api/payment-account";
import type { ActivePaymentAccountDto } from "@/api/payment-account-state";
import { ApiClientError, type MyEventDetailDto } from "@/api/types";
import { Card } from "@/components/ui/card";
import {
  DeclarePaymentModal,
  type PaymentMethodChoice,
  type PaymentTarget,
} from "@/components/cotisations/DeclarePaymentModal";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Détail événement + inscription / paiement Wero-Virement si payant.
 */
export default function EvenementDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = useMemo(() => {
    const raw = params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.id]);

  const [detail, setDetail] = useState<MyEventDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombrePersonnes, setNombrePersonnes] = useState(1);
  const [account, setAccount] = useState<ActivePaymentAccountDto | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethodChoice>("Virement");
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [payTarget, setPayTarget] = useState<PaymentTarget | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!id) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setDetail(await getMyEvent(id));
      } catch (e) {
        setDetail(null);
        setError(
          e instanceof ApiClientError
            ? evenementErrorMessage(e)
            : "Impossible de charger l'événement"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  async function onRegister() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await registerMyEvent(id, { nombrePersonnes });
      await load(true);
      Alert.alert("Inscription confirmée", "Vous êtes inscrit à cet événement.");
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? evenementErrorMessage(e)
          : "Inscription impossible"
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmWithdraw() {
    Alert.alert(
      "Se désinscrire ?",
      "Votre inscription à cet événement sera annulée.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désinscrire",
          style: "destructive",
          onPress: () => void onWithdraw(),
        },
      ]
    );
  }

  async function onWithdraw() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawMyEvent(id);
      await load(true);
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? evenementErrorMessage(e)
          : "Désinscription impossible"
      );
    } finally {
      setBusy(false);
    }
  }

  async function openPay(method: PaymentMethodChoice) {
    if (!detail?.inscriptionId || !detail.montantRestant) return;
    setBusy(true);
    setError(null);
    try {
      let acc = account;
      if (!acc) {
        acc = await getActivePaymentAccount();
        setAccount(acc);
      }
      setPayTarget({
        targetType: "inscription-evenement",
        targetId: detail.inscriptionId,
        label: detail.titre,
        restant: detail.montantRestant,
      });
      setPayMethod(method);
      setPayModalVisible(true);
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : "Compte de paiement indisponible"
      );
    } finally {
      setBusy(false);
    }
  }

  async function openMaps() {
    const q = detail?.adresse || detail?.lieu;
    if (!q) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    await Linking.openURL(url);
  }

  if (loading && !detail) return <LoadingState />;

  const prixLabel = detail ? formatEventPrix(detail.prix) : null;
  const totalEstimate =
    detail && !detail.estInscrit
      ? formatEventTotalEstimate(detail.prix, nombrePersonnes)
      : null;

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={AmakiColors.primary}
          />
        }
      >
        {error ? <ErrorBanner message={error} /> : null}
        {detail ? (
          <>
            <Text style={styles.title}>{detail.titre}</Text>
            <View style={styles.badgeRow}>
              <StatusBadge
                label={detail.statutLabel}
                tone={eventStatusTone(detail.statutLabel)}
              />
              {detail.obligatoireParticipation ? (
                <StatusBadge
                  label="Participation obligatoire"
                  tone="warning"
                />
              ) : null}
            </View>
            <Text style={styles.period}>
              {formatEventPeriod(detail.dateDebut, detail.dateFin)}
            </Text>
            {detail.lieu ? (
              <Text style={styles.lieu}>{detail.lieu}</Text>
            ) : null}
            {prixLabel ? (
              <Text style={styles.prix}>Tarif : {prixLabel} par personne</Text>
            ) : null}

            <Card style={styles.card}>
              <Text style={styles.section}>Description</Text>
              <Text style={styles.body}>{detail.description}</Text>
              {detail.contenu ? (
                <Text style={[styles.body, styles.contenu]}>
                  {detail.contenu}
                </Text>
              ) : null}
            </Card>

            {(detail.adresse || detail.lieu) && (
              <Card style={styles.card}>
                <Text style={styles.section}>Lieu</Text>
                {detail.adresse ? (
                  <Text style={styles.body}>{detail.adresse}</Text>
                ) : (
                  <Text style={styles.body}>{detail.lieu}</Text>
                )}
                <SecondaryButton
                  label="Ouvrir dans Maps"
                  onPress={() => void openMaps()}
                  style={styles.mapsBtn}
                />
              </Card>
            )}

            {placesLabel(detail.placesRestantes, detail.placesDisponibles) ? (
              <Text style={styles.places}>
                {placesLabel(detail.placesRestantes, detail.placesDisponibles)}
              </Text>
            ) : null}

            {detail.canRegister ? (
              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>Nombre de personnes</Text>
                <View style={styles.qtyControls}>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() =>
                      setNombrePersonnes((n) => Math.max(1, n - 1))
                    }
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyValue}>{nombrePersonnes}</Text>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() =>
                      setNombrePersonnes((n) => Math.min(20, n + 1))
                    }
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </Pressable>
                </View>
                {totalEstimate ? (
                  <Text style={styles.totalEstimate}>
                    Total estimé : {totalEstimate}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {detail.obligatoireParticipation && !detail.inscriptionRequis ? (
              <Text style={styles.obligatoireHint}>
                Participation obligatoire — aucune inscription en ligne requise.
              </Text>
            ) : null}

            {detail.estInscrit ? (
              <Text style={styles.inscrit}>
                Vous êtes inscrit
                {detail.nombrePersonnes
                  ? ` (${detail.nombrePersonnes} pers.)`
                  : ""}
              </Text>
            ) : null}

            {detail.estInscrit && detail.paymentRequired ? (
              <Card style={styles.payCard}>
                <Text style={styles.section}>Paiement</Text>
                <Text style={styles.payLine}>
                  Montant attendu : {detail.montantAttendu?.replace(".", ",")} €
                </Text>
                <Text style={styles.payLine}>
                  Payé : {detail.montantPaye?.replace(".", ",")} €
                </Text>
                <Text style={styles.payLine}>
                  Reste : {detail.montantRestant?.replace(".", ",")} €
                </Text>
                <View style={styles.badgeRow}>
                  <StatusBadge
                    label={eventPaymentStatusLabel(detail.statutPaiement)}
                    tone={
                      detail.statutPaiement === "Paye"
                        ? "success"
                        : detail.hasPendingPayment
                          ? "warning"
                          : "primary"
                    }
                  />
                </View>
                {detail.hasPendingPayment ? (
                  <Text style={styles.pendingHint}>
                    Paiement en attente de validation
                  </Text>
                ) : null}
                {detail.canPay ? (
                  <View style={styles.payActions}>
                    <PrimaryButton
                      label="Payer (Wero)"
                      loading={busy}
                      onPress={() => void openPay("Wero")}
                      style={styles.action}
                    />
                    <SecondaryButton
                      label="Payer (Virement)"
                      loading={busy}
                      onPress={() => void openPay("Virement")}
                      style={styles.action}
                    />
                  </View>
                ) : null}
                {detail.paiements?.length ? (
                  <View style={styles.payHistory}>
                    <Text style={styles.section}>Historique des paiements</Text>
                    {detail.paiements.map((p) => (
                      <View key={p.id} style={styles.payHistoryItem}>
                        <Text style={styles.payLine}>
                          {p.destinationLabel}
                        </Text>
                        <Text style={styles.payLine}>
                          {p.montant.replace(".", ",")} € · {p.moyenPaiement} ·{" "}
                          {p.statut}
                        </Text>
                        <Text style={styles.payMeta}>
                          {new Date(p.datePaiement).toLocaleString("fr-FR")}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : null}

            {detail.canRegister ? (
              <PrimaryButton
                label="S'inscrire"
                loading={busy}
                onPress={() => void onRegister()}
                style={styles.action}
              />
            ) : null}

            {detail.inscriptionRequis &&
            !detail.canRegister &&
            !detail.estInscrit ? (
              <Text style={styles.closed}>Inscription fermée</Text>
            ) : null}

            {detail.canWithdraw ? (
              <SecondaryButton
                label="Se désinscrire"
                loading={busy}
                onPress={confirmWithdraw}
                style={styles.action}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {account && payTarget ? (
        <DeclarePaymentModal
          visible={payModalVisible}
          account={account}
          method={payMethod}
          target={payTarget}
          payableTargets={[payTarget]}
          onClose={() => setPayModalVisible(false)}
          onSuccess={(msg) => {
            setPayModalVisible(false);
            Alert.alert("Déclaration enregistrée", msg);
            void load(true);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  container: { padding: AmakiSpacing.lg, paddingBottom: AmakiSpacing["2xl"] },
  title: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
  },
  badgeRow: {
    alignSelf: "flex-start",
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: AmakiSpacing.xs,
    marginTop: AmakiSpacing.sm,
  },
  period: {
    ...AmakiTypography.body,
    color: AmakiColors.primaryStrong,
    fontWeight: "600",
    marginTop: AmakiSpacing.sm,
  },
  lieu: {
    ...AmakiTypography.caption,
    color: AmakiColors.textSecondary,
    marginTop: AmakiSpacing.xs,
  },
  prix: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    fontWeight: "700",
    marginTop: AmakiSpacing.sm,
  },
  card: { marginTop: AmakiSpacing.lg },
  payCard: {
    marginTop: AmakiSpacing.lg,
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  section: {
    ...AmakiTypography.label,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.sm,
  },
  body: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
  },
  contenu: { marginTop: AmakiSpacing.md },
  mapsBtn: { marginTop: AmakiSpacing.md, alignSelf: "flex-start" },
  places: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.md,
  },
  qtyRow: { marginTop: AmakiSpacing.lg },
  qtyLabel: {
    ...AmakiTypography.label,
    color: AmakiColors.textMuted,
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: AmakiSpacing.md,
    marginTop: AmakiSpacing.sm,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: AmakiRadius.sm,
    backgroundColor: AmakiColors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnText: {
    ...AmakiTypography.heading,
    color: AmakiColors.primaryStrong,
  },
  qtyValue: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    minWidth: 24,
    textAlign: "center",
  },
  totalEstimate: {
    ...AmakiTypography.body,
    color: AmakiColors.primaryStrong,
    fontWeight: "700",
    marginTop: AmakiSpacing.sm,
  },
  obligatoireHint: {
    ...AmakiTypography.body,
    color: AmakiColors.warning,
    fontWeight: "600",
    marginTop: AmakiSpacing.lg,
  },
  inscrit: {
    ...AmakiTypography.heading,
    color: AmakiColors.success,
    marginTop: AmakiSpacing.lg,
  },
  payLine: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    marginBottom: 4,
  },
  pendingHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.warning,
    marginTop: AmakiSpacing.sm,
    fontWeight: "600",
  },
  payActions: { marginTop: AmakiSpacing.sm },
  payHistory: { marginTop: AmakiSpacing.md },
  payHistoryItem: {
    marginBottom: AmakiSpacing.sm,
    paddingTop: AmakiSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#fed7aa",
  },
  payMeta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
  },
  closed: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: AmakiSpacing.lg,
  },
  action: { marginTop: AmakiSpacing.md },
});
