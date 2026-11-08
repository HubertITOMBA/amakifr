"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  Snowflake,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RappelsOperationsAdherentSearch } from "@/components/admin/RappelsOperationsAdherentSearch";
import { getRappelDetteAdminCapabilitiesAction } from "@/actions/cotisations/get-rappel-dette-admin-capabilities";
import { listRappelDetteEnvoisAction } from "@/actions/cotisations/list-rappel-dette-envois";
import { listRappelDetteGelsAction } from "@/actions/cotisations/list-rappel-dette-gels";
import { prepareRappelDetteConfirmationAction } from "@/actions/cotisations/prepare-rappel-dette-confirmation";
import { confirmRappelDetteManualSendAction } from "@/actions/cotisations/confirm-rappel-dette-manual-send";
import { resumeRappelDetteNotificationAction } from "@/actions/cotisations/resume-rappel-dette-notification";
import { poseRappelDetteGelAction } from "@/actions/cotisations/pose-rappel-dette-gel";
import { leveRappelDetteGelAction } from "@/actions/cotisations/leve-rappel-dette-gel";
import {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";
import { formatPreviewEuroAmount } from "@/lib/services/cotisations/rappel-dette/preview-display";
import {
  formatOperationsDateTime,
  formatRappelDetteGelMotifLabel,
  isPrepareExpired,
  RAPPEL_DETTE_CONFIRM_UNCERTAIN_MESSAGE,
  RAPPEL_DETTE_CONFIRM_UNCERTAIN_OPS_HINT,
  RAPPEL_DETTE_EMAIL_ACCEPTED_UI_LABEL,
  RAPPEL_DETTE_ENVOI_FLAG_OFF_BANNER,
  RAPPEL_DETTE_GEL_FLAG_OFF_BANNER,
  RAPPEL_DETTE_GEL_NON_RETROACTIF_MESSAGE,
  RAPPEL_DETTE_OPERATIONS_REFRESH_TOAST,
  RAPPEL_DETTE_SOURCE_UNAVAILABLE_UI,
} from "@/lib/services/cotisations/rappel-dette/rappels-operations-display";

/** Case confirmation ops — taille ~24px, contraste, focus (présentation locale page). */
const OPS_CONFIRM_CHECKBOX_CLASS =
  "mt-0.5 size-6 shrink-0 rounded-[4px] border-2 border-slate-700 " +
  "bg-white text-white shadow-sm " +
  "data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-700 " +
  "data-[state=checked]:text-white " +
  "focus-visible:border-blue-600 focus-visible:ring-2 " +
  "focus-visible:ring-blue-500 focus-visible:ring-offset-2";

const OPS_CONFIRM_ZONE_CLASS =
  "flex items-start gap-3 rounded-md border-2 border-slate-400 " +
  "bg-white p-3 shadow-sm hover:bg-slate-50 " +
  "focus-within:outline-none focus-within:ring-2 " +
  "focus-within:ring-blue-500 focus-within:ring-offset-2 " +
  "has-[:disabled]:opacity-60";

const OPS_CONFIRM_LABEL_CLASS =
  "flex-1 min-h-6 font-sans text-sm sm:text-base " +
  "leading-relaxed text-slate-900 cursor-pointer " +
  "peer-disabled:cursor-not-allowed";

const OPS_DIALOG_BODY_CLASS = "space-y-3 py-2 font-sans text-sm sm:text-base leading-relaxed text-slate-900";
const OPS_DIALOG_LABEL_CLASS =
  "text-sm font-semibold text-slate-800";
import { RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE } from "@/lib/services/cotisations/rappel-dette/rappel-dette-admin-read-constants";
import type {
  RappelDetteAdminCapabilities,
  RappelDetteEnvoiListItem,
  RappelDetteGelListItem,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-admin-reads";

type SelectedAdherent = {
  id: string;
  firstname: string;
  lastname: string;
  disambiguationLabel: string | null;
};

type PrepareView = {
  adherentId: string;
  detteNette: string;
  referenceAt: string;
  referenceLabel: string;
  recipientMasked: string;
  prepareExpiresAt: string;
  gelsRevision: string;
  templateVersion: string;
};

type ListLoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "ready" }
  | { kind: "source_unavailable"; message: string }
  | { kind: "error"; message: string };

type MotifCode = "CONTESTATION" | "VERIFICATION_ADMINISTRATIVE" | "AUTRE";

/**
 * Page admin Lot 3 — opérations unitaires rappels dette.
 * Lecture capacités/historiques ; mutations uniquement sur actions explicites.
 * Jeton de confirmation : mémoire React uniquement (jamais URL / localStorage / logs).
 *
 * Recherche adhérents : `RappelsOperationsAdherentSearch` (action bornée
 * ADMIN|PRESID) — pas de `getAllUsersForAdmin` / AdherentSearchDialog.
 */
export default function AdminRappelsOperationsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const user = session?.user;
  const clientCanAccess = canAccessPreviewRappelsDette(user?.role);
  const sessionResolved = sessionStatus !== "loading";
  const sessionAllowed =
    sessionResolved && sessionStatus === "authenticated" && clientCanAccess;

  const [accessDenied, setAccessDenied] = useState(false);
  const [capsLoading, setCapsLoading] = useState(false);
  const [capabilities, setCapabilities] =
    useState<RappelDetteAdminCapabilities | null>(null);

  const [selected, setSelected] = useState<SelectedAdherent | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const confirmationTokenRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const sessionGenRef = useRef(0);
  const capsReqRef = useRef(0);
  const prepareLockRef = useRef(false);
  const confirmLockRef = useRef(false);
  const poseLockRef = useRef(false);
  const leveLockRef = useRef(false);
  const resumeLockRef = useRef(false);
  /** Incertitude sticky par adhérent (confirm réseau) — jamais levée par Actualiser/historique. */
  const uncertainAdherentsRef = useRef<Set<string>>(new Set());
  const [uncertainAdherentIds, setUncertainAdherentIds] = useState<string[]>(
    []
  );

  const [prepareView, setPrepareView] = useState<PrepareView | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [prepareBusy, setPrepareBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  const [envois, setEnvois] = useState<RappelDetteEnvoiListItem[]>([]);
  const [envoisCursor, setEnvoisCursor] = useState<string | null>(null);
  const [envoisHasMore, setEnvoisHasMore] = useState(false);
  const [envoisState, setEnvoisState] = useState<ListLoadState>({ kind: "idle" });
  const [envoisMoreBusy, setEnvoisMoreBusy] = useState(false);

  const [gels, setGels] = useState<RappelDetteGelListItem[]>([]);
  const [gelsCursor, setGelsCursor] = useState<string | null>(null);
  const [gelsHasMore, setGelsHasMore] = useState(false);
  const [gelsState, setGelsState] = useState<ListLoadState>({ kind: "idle" });
  const [gelsMoreBusy, setGelsMoreBusy] = useState(false);

  const [resumeBusyId, setResumeBusyId] = useState<string | null>(null);

  const [poseOpen, setPoseOpen] = useState(false);
  const [poseMotifCode, setPoseMotifCode] = useState<MotifCode | undefined>(
    undefined
  );
  const [poseMotifTexte, setPoseMotifTexte] = useState("");
  const [poseConfirmChecked, setPoseConfirmChecked] = useState(false);
  const [poseBusy, setPoseBusy] = useState(false);
  const [poseError, setPoseError] = useState<string | null>(null);

  const [leveTarget, setLeveTarget] = useState<RappelDetteGelListItem | null>(
    null
  );
  const [leveBusy, setLeveBusy] = useState(false);

  const confirmUncertain = useMemo(
    () =>
      selected != null && uncertainAdherentIds.includes(selected.id),
    [selected, uncertainAdherentIds]
  );

  const markUncertain = useCallback((adherentId: string) => {
    uncertainAdherentsRef.current.add(adherentId);
    setUncertainAdherentIds(Array.from(uncertainAdherentsRef.current));
  }, []);

  const clearPrepare = useCallback(() => {
    confirmationTokenRef.current = null;
    setPrepareView(null);
    setConfirmChecked(false);
    setPrepareError(null);
  }, []);

  const invalidateForSelectionOrSession = useCallback(() => {
    clearPrepare();
    prepareLockRef.current = false;
    confirmLockRef.current = false;
    poseLockRef.current = false;
    leveLockRef.current = false;
    resumeLockRef.current = false;
    setPrepareBusy(false);
    setConfirmBusy(false);
    setPoseBusy(false);
    setLeveBusy(false);
    setResumeBusyId(null);
    setPoseOpen(false);
    setLeveTarget(null);
  }, [clearPrepare]);

  const mutationsAllowed =
    sessionAllowed &&
    !accessDenied &&
    capabilities != null &&
    !capsLoading;

  const envoiMutationsAllowed =
    mutationsAllowed && capabilities?.envoiEnabled === true;
  const gelMutationsAllowed =
    mutationsAllowed && capabilities?.gelMutationEnabled === true;

  const loadCapabilities = useCallback(
    async (options?: { manual?: boolean }) => {
      if (!sessionAllowed) return;
      const gen = sessionGenRef.current;
      const req = ++capsReqRef.current;
      try {
        setCapsLoading(true);
        const res = await getRappelDetteAdminCapabilitiesAction({});
        if (gen !== sessionGenRef.current || req !== capsReqRef.current) {
          return;
        }
        if (!res.success) {
          if (
            res.code === "FORBIDDEN" ||
            res.code === "UNAUTHENTICATED" ||
            res.error === PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE
          ) {
            setAccessDenied(true);
            setCapabilities(null);
            invalidateForSelectionOrSession();
            return;
          }
          toast.error(res.error || "Erreur capacités");
          setCapabilities(null);
          return;
        }
        setAccessDenied(false);
        setCapabilities(res.data);
        if (options?.manual) {
          toast.success(RAPPEL_DETTE_OPERATIONS_REFRESH_TOAST);
        }
      } catch (error) {
        if (gen !== sessionGenRef.current || req !== capsReqRef.current) {
          return;
        }
        console.error("[AdminRappelsOperationsPage]", {
          category: "capabilities_failed",
          name: error instanceof Error ? error.name : "unknown",
        });
        toast.error("Erreur lors du chargement des capacités");
        setCapabilities(null);
      } finally {
        if (gen === sessionGenRef.current && req === capsReqRef.current) {
          setCapsLoading(false);
        }
      }
    },
    [sessionAllowed, invalidateForSelectionOrSession]
  );

  const loadEnvois = useCallback(
    async (adherentId: string, cursor: string | null, append: boolean) => {
      const gen = sessionGenRef.current;
      if (append) {
        setEnvoisMoreBusy(true);
      } else {
        setEnvoisState({ kind: "loading" });
      }
      try {
        const res = await listRappelDetteEnvoisAction({
          adherentId,
          cursor,
        });
        if (
          gen !== sessionGenRef.current ||
          selectedIdRef.current !== adherentId
        ) {
          return;
        }
        if (!res.success) {
          if (res.code === RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE) {
            if (!append) {
              setEnvois([]);
              setEnvoisCursor(null);
              setEnvoisHasMore(false);
              setEnvoisState({
                kind: "source_unavailable",
                message: res.error || RAPPEL_DETTE_SOURCE_UNAVAILABLE_UI,
              });
            } else {
              toast.error(res.error || RAPPEL_DETTE_SOURCE_UNAVAILABLE_UI);
            }
            return;
          }
          if (res.code === "FORBIDDEN" || res.code === "UNAUTHENTICATED") {
            setAccessDenied(true);
            invalidateForSelectionOrSession();
            return;
          }
          if (!append) {
            setEnvois([]);
            setEnvoisState({
              kind: "error",
              message: res.error || "Erreur historique envois",
            });
          } else {
            toast.error(res.error || "Erreur pagination envois");
          }
          return;
        }
        const items = res.data.items;
        setEnvois((prev) => (append ? [...prev, ...items] : items));
        setEnvoisCursor(res.data.nextCursor);
        setEnvoisHasMore(res.data.hasMore);
        if (!append) {
          setEnvoisState(
            items.length === 0 ? { kind: "empty" } : { kind: "ready" }
          );
        }
      } catch (error) {
        if (
          gen !== sessionGenRef.current ||
          selectedIdRef.current !== adherentId
        ) {
          return;
        }
        console.error("[AdminRappelsOperationsPage]", {
          category: "envois_failed",
          name: error instanceof Error ? error.name : "unknown",
        });
        if (!append) {
          setEnvoisState({
            kind: "error",
            message: "Erreur réseau historique envois",
          });
        } else {
          toast.error("Erreur réseau pagination envois");
        }
      } finally {
        if (
          gen === sessionGenRef.current &&
          selectedIdRef.current === adherentId
        ) {
          setEnvoisMoreBusy(false);
        }
      }
    },
    [invalidateForSelectionOrSession]
  );

  const loadGels = useCallback(
    async (adherentId: string, cursor: string | null, append: boolean) => {
      const gen = sessionGenRef.current;
      if (append) {
        setGelsMoreBusy(true);
      } else {
        setGelsState({ kind: "loading" });
      }
      try {
        const res = await listRappelDetteGelsAction({
          adherentId,
          cursor,
        });
        if (
          gen !== sessionGenRef.current ||
          selectedIdRef.current !== adherentId
        ) {
          return;
        }
        if (!res.success) {
          if (res.code === RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE) {
            if (!append) {
              setGels([]);
              setGelsCursor(null);
              setGelsHasMore(false);
              setGelsState({
                kind: "source_unavailable",
                message: res.error || RAPPEL_DETTE_SOURCE_UNAVAILABLE_UI,
              });
            } else {
              toast.error(res.error || RAPPEL_DETTE_SOURCE_UNAVAILABLE_UI);
            }
            return;
          }
          if (res.code === "FORBIDDEN" || res.code === "UNAUTHENTICATED") {
            setAccessDenied(true);
            invalidateForSelectionOrSession();
            return;
          }
          if (!append) {
            setGels([]);
            setGelsState({
              kind: "error",
              message: res.error || "Erreur historique gels",
            });
          } else {
            toast.error(res.error || "Erreur pagination gels");
          }
          return;
        }
        const items = res.data.items;
        setGels((prev) => (append ? [...prev, ...items] : items));
        setGelsCursor(res.data.nextCursor);
        setGelsHasMore(res.data.hasMore);
        if (!append) {
          setGelsState(
            items.length === 0 ? { kind: "empty" } : { kind: "ready" }
          );
        }
      } catch (error) {
        if (
          gen !== sessionGenRef.current ||
          selectedIdRef.current !== adherentId
        ) {
          return;
        }
        console.error("[AdminRappelsOperationsPage]", {
          category: "gels_failed",
          name: error instanceof Error ? error.name : "unknown",
        });
        if (!append) {
          setGelsState({
            kind: "error",
            message: "Erreur réseau historique gels",
          });
        } else {
          toast.error("Erreur réseau pagination gels");
        }
      } finally {
        if (
          gen === sessionGenRef.current &&
          selectedIdRef.current === adherentId
        ) {
          setGelsMoreBusy(false);
        }
      }
    },
    [invalidateForSelectionOrSession]
  );

  const refreshHistories = useCallback(
    async (adherentId: string) => {
      await Promise.all([
        loadEnvois(adherentId, null, false),
        loadGels(adherentId, null, false),
      ]);
    },
    [loadEnvois, loadGels]
  );

  // Session résolue : refus immédiat hors ADMIN|PRESID ; capacités seulement si autorisé.
  useEffect(() => {
    if (!sessionResolved) return;

    sessionGenRef.current += 1;
    capsReqRef.current += 1;
    invalidateForSelectionOrSession();

    if (sessionStatus !== "authenticated" || !clientCanAccess) {
      setAccessDenied(true);
      setCapabilities(null);
      setCapsLoading(false);
      selectedIdRef.current = null;
      setSelected(null);
      setEnvois([]);
      setGels([]);
      setEnvoisState({ kind: "idle" });
      setGelsState({ kind: "idle" });
      return;
    }

    setAccessDenied(false);
    void loadCapabilities();
  }, [
    sessionResolved,
    sessionStatus,
    clientCanAccess,
    user?.id,
    user?.role,
    loadCapabilities,
    invalidateForSelectionOrSession,
  ]);

  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;
    if (!selected) {
      setEnvois([]);
      setGels([]);
      setEnvoisState({ kind: "idle" });
      setGelsState({ kind: "idle" });
      clearPrepare();
      return;
    }
    clearPrepare();
    void refreshHistories(selected.id);
  }, [selected, refreshHistories, clearPrepare]);

  const handleRefresh = async () => {
    if (!sessionAllowed || accessDenied) return;
    await loadCapabilities({ manual: true });
    if (selectedIdRef.current) {
      await refreshHistories(selectedIdRef.current);
    }
    // Incertitude sticky : Actualiser / historiques ne la lèvent pas.
  };

  const handleSelectAdherent = (adherent: SelectedAdherent) => {
    setSelected(adherent);
    setSearchOpen(false);
    // clearPrepare via effet selected ; incertitude de l’adhérent conservée.
  };

  const handlePrepare = async () => {
    if (prepareLockRef.current || confirmLockRef.current) return;
    if (!selected || confirmUncertain) return;
    if (!envoiMutationsAllowed) {
      toast.error(
        !capabilities?.envoiEnabled
          ? RAPPEL_DETTE_ENVOI_FLAG_OFF_BANNER
          : PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE
      );
      return;
    }
    prepareLockRef.current = true;
    setPrepareBusy(true);
    setPrepareError(null);
    setConfirmChecked(false);
    const adherentId = selected.id;
    const gen = sessionGenRef.current;
    try {
      const res = await prepareRappelDetteConfirmationAction({
        adherentId,
      });
      if (
        gen !== sessionGenRef.current ||
        selectedIdRef.current !== adherentId
      ) {
        return;
      }
      if (!res.success) {
        confirmationTokenRef.current = null;
        setPrepareView(null);
        setPrepareError(res.error);
        toast.error(res.error);
        return;
      }
      confirmationTokenRef.current = res.data.confirmationToken;
      setPrepareView({
        adherentId: res.data.adherentId,
        detteNette: res.data.detteNette,
        referenceAt: res.data.referenceAt,
        referenceLabel: res.data.referenceLabel,
        recipientMasked: res.data.recipientMasked,
        prepareExpiresAt: res.data.prepareExpiresAt,
        gelsRevision: res.data.gelsRevision,
        templateVersion: res.data.templateVersion,
      });
      toast.success("Préparation prête — confirmation explicite requise.");
    } catch (error) {
      if (
        gen !== sessionGenRef.current ||
        selectedIdRef.current !== adherentId
      ) {
        return;
      }
      console.error("[AdminRappelsOperationsPage]", {
        category: "prepare_failed",
        name: error instanceof Error ? error.name : "unknown",
      });
      confirmationTokenRef.current = null;
      setPrepareView(null);
      toast.error("Erreur réseau lors de la préparation");
    } finally {
      if (
        gen === sessionGenRef.current &&
        selectedIdRef.current === adherentId
      ) {
        prepareLockRef.current = false;
        setPrepareBusy(false);
      } else {
        prepareLockRef.current = false;
      }
    }
  };

  const handleConfirm = async () => {
    if (confirmLockRef.current || prepareLockRef.current) return;
    if (!prepareView || !confirmChecked || confirmUncertain) return;
    if (!envoiMutationsAllowed) {
      toast.error(
        !capabilities?.envoiEnabled
          ? RAPPEL_DETTE_ENVOI_FLAG_OFF_BANNER
          : PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE
      );
      return;
    }
    const token = confirmationTokenRef.current;
    if (!token) {
      setPrepareError("Jeton absent — nouvelle préparation requise.");
      clearPrepare();
      return;
    }
    if (isPrepareExpired(prepareView.prepareExpiresAt)) {
      clearPrepare();
      setPrepareError(
        "Préparation expirée — nouvelle préparation et nouvelle confirmation requises."
      );
      toast.warning("Préparation expirée");
      return;
    }

    confirmLockRef.current = true;
    setConfirmBusy(true);
    const adherentId = prepareView.adherentId;
    const gen = sessionGenRef.current;
    try {
      const res = await confirmRappelDetteManualSendAction({
        confirmationToken: token,
      });
      if (
        gen !== sessionGenRef.current ||
        selectedIdRef.current !== adherentId
      ) {
        return;
      }
      if (!res.success) {
        if (res.nextHint === "reconfirm") {
          clearPrepare();
          setPrepareError(
            `${res.error} — nouvelle préparation et nouvelle confirmation requises.`
          );
          toast.error(res.error);
          return;
        }
        clearPrepare();
        setPrepareError(res.error);
        toast.error(res.error);
        return;
      }
      clearPrepare();
      toast.success("Envoi accepté par le serveur (vérifier l’historique).");
      if (selectedIdRef.current === adherentId) {
        await refreshHistories(adherentId);
      }
    } catch (error) {
      if (
        gen !== sessionGenRef.current ||
        selectedIdRef.current !== adherentId
      ) {
        // Même obsolète : conserver l’incertitude pour l’adhérent de la tentative.
        markUncertain(adherentId);
        confirmationTokenRef.current = null;
        return;
      }
      console.error("[AdminRappelsOperationsPage]", {
        category: "confirm_network_uncertain",
        name: error instanceof Error ? error.name : "unknown",
      });
      confirmationTokenRef.current = null;
      setPrepareView(null);
      setConfirmChecked(false);
      markUncertain(adherentId);
      toast.error(RAPPEL_DETTE_CONFIRM_UNCERTAIN_MESSAGE);
    } finally {
      confirmLockRef.current = false;
      if (
        gen === sessionGenRef.current &&
        selectedIdRef.current === adherentId
      ) {
        setConfirmBusy(false);
      } else {
        setConfirmBusy(false);
      }
    }
  };

  const handleResumeNotif = async (item: RappelDetteEnvoiListItem) => {
    if (resumeLockRef.current) return;
    if (!item.canResumeNotif || !selected) return;
    if (!envoiMutationsAllowed) {
      toast.error(
        !capabilities?.envoiEnabled
          ? RAPPEL_DETTE_ENVOI_FLAG_OFF_BANNER
          : PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE
      );
      return;
    }
    resumeLockRef.current = true;
    setResumeBusyId(item.id);
    const adherentId = selected.id;
    const gen = sessionGenRef.current;
    try {
      const res = await resumeRappelDetteNotificationAction({
        envoiId: item.id,
        adherentId,
      });
      if (
        gen !== sessionGenRef.current ||
        selectedIdRef.current !== adherentId
      ) {
        return;
      }
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Reprise de notification demandée.");
      await refreshHistories(adherentId);
    } catch (error) {
      if (
        gen !== sessionGenRef.current ||
        selectedIdRef.current !== adherentId
      ) {
        return;
      }
      console.error("[AdminRappelsOperationsPage]", {
        category: "resume_failed",
        name: error instanceof Error ? error.name : "unknown",
      });
      toast.error("Erreur réseau lors de la reprise de notification");
    } finally {
      resumeLockRef.current = false;
      if (
        gen === sessionGenRef.current &&
        selectedIdRef.current === adherentId
      ) {
        setResumeBusyId(null);
      } else {
        setResumeBusyId(null);
      }
    }
  };

  const handlePose = async () => {
    if (poseLockRef.current) return;
    if (!selected) return;
    if (!gelMutationsAllowed) {
      toast.error(
        !capabilities?.gelMutationEnabled
          ? RAPPEL_DETTE_GEL_FLAG_OFF_BANNER
          : PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE
      );
      return;
    }
    if (!poseMotifCode) {
      setPoseError("Motif obligatoire.");
      return;
    }
    if (!poseMotifTexte.trim()) {
      setPoseError("Commentaire motif obligatoire.");
      return;
    }
    if (!poseConfirmChecked) {
      setPoseError("Confirmation explicite requise.");
      return;
    }
    poseLockRef.current = true;
    setPoseBusy(true);
    setPoseError(null);
    const adherentId = selected.id;
    const gen = sessionGenRef.current;
    try {
      const res = await poseRappelDetteGelAction({
        scope: "ADHERENT",
        adherentId,
        motifCode: poseMotifCode,
        motifTexte: poseMotifTexte.trim(),
      });
      if (
        gen !== sessionGenRef.current ||
        selectedIdRef.current !== adherentId
      ) {
        return;
      }
      if (!res.success) {
        setPoseError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.outcome === "already_active"
          ? "Gel déjà actif."
          : "Gel posé."
      );
      setPoseOpen(false);
      setPoseMotifCode(undefined);
      setPoseMotifTexte("");
      setPoseConfirmChecked(false);
      clearPrepare();
      await refreshHistories(adherentId);
    } catch (error) {
      if (
        gen !== sessionGenRef.current ||
        selectedIdRef.current !== adherentId
      ) {
        return;
      }
      console.error("[AdminRappelsOperationsPage]", {
        category: "pose_failed",
        name: error instanceof Error ? error.name : "unknown",
      });
      toast.error("Erreur réseau lors de la pose du gel");
    } finally {
      poseLockRef.current = false;
      if (
        gen === sessionGenRef.current &&
        selectedIdRef.current === adherentId
      ) {
        setPoseBusy(false);
      } else {
        setPoseBusy(false);
      }
    }
  };

  const handleLeve = async () => {
    if (leveLockRef.current) return;
    if (!leveTarget || !selected) return;
    if (!gelMutationsAllowed) {
      toast.error(
        !capabilities?.gelMutationEnabled
          ? RAPPEL_DETTE_GEL_FLAG_OFF_BANNER
          : PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE
      );
      return;
    }
    leveLockRef.current = true;
    setLeveBusy(true);
    const adherentId = selected.id;
    const gelId = leveTarget.id;
    const gen = sessionGenRef.current;
    try {
      const res = await leveRappelDetteGelAction({
        adherentId,
        gelId,
      });
      if (
        gen !== sessionGenRef.current ||
        selectedIdRef.current !== adherentId
      ) {
        return;
      }
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data.outcome === "already_lifted"
          ? "Gel déjà levé."
          : "Gel levé."
      );
      setLeveTarget(null);
      clearPrepare();
      await refreshHistories(adherentId);
    } catch (error) {
      if (
        gen !== sessionGenRef.current ||
        selectedIdRef.current !== adherentId
      ) {
        return;
      }
      console.error("[AdminRappelsOperationsPage]", {
        category: "leve_failed",
        name: error instanceof Error ? error.name : "unknown",
      });
      toast.error("Erreur réseau lors de la levée du gel");
    } finally {
      leveLockRef.current = false;
      if (
        gen === sessionGenRef.current &&
        selectedIdRef.current === adherentId
      ) {
        setLeveBusy(false);
      } else {
        setLeveBusy(false);
      }
    }
  };

  if (!sessionResolved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Vérification de la session…
        </div>
      </div>
    );
  }

  if (accessDenied || (sessionResolved && !clientCanAccess)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4 sm:p-6">
        <Card className="max-w-lg border-red-200 dark:border-red-800 shadow-lg w-full pt-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-red-500/90 to-red-600/90 text-white rounded-t-lg px-4 sm:px-6 py-3 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldAlert className="h-5 w-5" />
              {PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-sm text-slate-700 dark:text-slate-200 px-4 sm:px-6 pb-4">
            <p>
              Les opérations rappels sont réservées aux administrateurs et au
              président.
            </p>
            <Link
              href="/admin/finances"
              className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour aux finances
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const envoiOff = capabilities ? !capabilities.envoiEnabled : false;
  const gelOff = capabilities ? !capabilities.gelMutationEnabled : false;
  const prepareExpired =
    prepareView != null && isPrepareExpired(prepareView.prepareExpiresAt);

  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="w-full max-w-none space-y-3 p-3 sm:space-y-4 sm:p-4 lg:p-6">
        <Link
          href="/admin/finances"
          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Finances
        </Link>

        <div className="overflow-hidden rounded-xl border border-blue-300/60 dark:border-indigo-700 shadow-lg bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-700 dark:from-blue-700 dark:via-indigo-700 dark:to-indigo-900">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3 sm:px-5 lg:px-6 py-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Send className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
                Opérations rappels dette
              </h1>
              <p className="text-blue-100 text-xs sm:text-sm mt-1">
                Envoi unitaire, historiques et gels
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={capsLoading || !sessionAllowed}
              className="bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white w-full sm:w-auto"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${capsLoading ? "animate-spin" : ""}`}
              />
              Actualiser
            </Button>
          </div>
        </div>

        <Card className="shadow-md border-slate-200 dark:border-slate-700 pt-0 pb-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-t-lg px-3 sm:px-4 lg:px-5 py-2.5 gap-1">
            <CardTitle className="text-base sm:text-lg text-slate-800 dark:text-slate-100">
              Fonctions disponibles
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 lg:px-5 py-3 text-sm">
            {capsLoading && !capabilities ? (
              <div className="flex items-center gap-2 text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement…
              </div>
            ) : capabilities ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={
                      capabilities.envoiEnabled
                        ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                        : "border-amber-400 bg-amber-50 text-amber-900"
                    }
                  >
                    Envoi : {capabilities.envoiEnabled ? "activé" : "désactivé"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      capabilities.gelMutationEnabled
                        ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                        : "border-amber-400 bg-amber-50 text-amber-900"
                    }
                  >
                    Gestion des gels :{" "}
                    {capabilities.gelMutationEnabled ? "activée" : "désactivée"}
                  </Badge>
                </div>
                {(envoiOff || gelOff) && (
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {envoiOff ? (
                      <p
                        role="status"
                        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-amber-950 text-xs"
                      >
                        {RAPPEL_DETTE_ENVOI_FLAG_OFF_BANNER}
                      </p>
                    ) : null}
                    {gelOff ? (
                      <p
                        role="status"
                        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-amber-950 text-xs"
                      >
                        {RAPPEL_DETTE_GEL_FLAG_OFF_BANNER}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-600">Fonctions indisponibles.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 lg:items-start">
        <Card className="shadow-md border-blue-200 dark:border-blue-800 pt-0 pb-0 gap-0 min-w-0">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white rounded-t-lg px-3 sm:px-4 lg:px-5 py-2.5">
            <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
              <User className="h-5 w-5" />
              Adhérent cible
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 lg:px-5 py-3 space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Recherchez un adhérent par nom ou prénom (au moins 2 caractères).
            </p>
            {selected ? (
              <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">
                  {selected.firstname} {selected.lastname}
                </p>
                {selected.disambiguationLabel ? (
                  <p className="text-xs text-slate-600 mt-0.5">
                    {selected.disambiguationLabel}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Aucun adhérent sélectionné.</p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setSearchOpen(true)}
              className="border-blue-300 hover:bg-blue-50"
            >
              {selected ? "Changer d’adhérent" : "Rechercher un adhérent"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md border-indigo-200 dark:border-indigo-800 pt-0 pb-0 gap-0 min-w-0">
          <CardHeader className="bg-gradient-to-r from-indigo-500/90 to-indigo-600/90 text-white rounded-t-lg px-3 sm:px-4 lg:px-5 py-2.5">
            <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
              <Mail className="h-5 w-5" />
              Préparation et confirmation d’envoi
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 lg:px-5 py-3 space-y-3 text-sm">
            {!selected ? (
              <p className="text-slate-600">Sélectionnez d’abord un adhérent.</p>
            ) : confirmUncertain ? (
              <div
                role="alert"
                className="rounded-md border border-red-300 bg-red-50 px-3 py-3 text-red-950 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>{RAPPEL_DETTE_CONFIRM_UNCERTAIN_MESSAGE}</p>
                </div>
                <p className="text-xs">{RAPPEL_DETTE_CONFIRM_UNCERTAIN_OPS_HINT}</p>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={() => void handlePrepare()}
                  disabled={
                    prepareBusy ||
                    confirmBusy ||
                    !envoiMutationsAllowed ||
                    !selected ||
                    confirmUncertain
                  }
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {prepareBusy ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Préparer l’envoi
                </Button>

                {prepareError ? (
                  <p role="alert" className="text-xs text-red-700">
                    {prepareError}
                  </p>
                ) : null}

                {prepareView ? (
                  <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-100 px-2 py-1 rounded-t-md">
                          Montant net
                        </p>
                        <p className="p-2 bg-blue-50 border border-blue-200 border-t-0 rounded-md rounded-tl-none text-xs">
                          {formatPreviewEuroAmount(prepareView.detteNette)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-100 px-2 py-1 rounded-t-md">
                          Date / heure de référence
                        </p>
                        <p className="p-2 bg-blue-50 border border-blue-200 border-t-0 rounded-md rounded-tl-none text-xs">
                          {formatOperationsDateTime(prepareView.referenceAt)}
                          <span className="block text-slate-500 mt-0.5">
                            {prepareView.referenceLabel}
                          </span>
                        </p>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-100 px-2 py-1 rounded-t-md">
                          Destinataire (masqué)
                        </p>
                        <p className="p-2 bg-blue-50 border border-blue-200 border-t-0 rounded-md rounded-tl-none text-xs">
                          {prepareView.recipientMasked}
                        </p>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-100 px-2 py-1 rounded-t-md">
                          Expiration préparation
                        </p>
                        <p className="p-2 bg-blue-50 border border-blue-200 border-t-0 rounded-md rounded-tl-none text-xs">
                          {formatOperationsDateTime(prepareView.prepareExpiresAt)}
                          {prepareExpired ? (
                            <span className="block text-red-700 mt-1">
                              Expirée — nouvelle préparation requise
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    {/*
                      Zone entière cliquable via Label htmlFor (frère du Checkbox Radix) —
                      évite le double basculement d’un Checkbox imbriqué dans <label>.
                    */}
                    <div className={OPS_CONFIRM_ZONE_CLASS}>
                      <Checkbox
                        id="confirm-send-check"
                        checked={confirmChecked}
                        onCheckedChange={(v) => setConfirmChecked(v === true)}
                        disabled={confirmBusy || prepareExpired}
                        className={OPS_CONFIRM_CHECKBOX_CLASS}
                      />
                      <Label
                        htmlFor="confirm-send-check"
                        className={OPS_CONFIRM_LABEL_CLASS}
                      >
                        Je confirme l’envoi de ce rappel à l’adhérent
                        sélectionné, pour le montant et le destinataire
                        indiqués.
                      </Label>
                    </div>

                    <Button
                      type="button"
                      onClick={() => void handleConfirm()}
                      disabled={
                        !confirmChecked ||
                        confirmBusy ||
                        prepareBusy ||
                        prepareExpired ||
                        !envoiMutationsAllowed
                      }
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {confirmBusy ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Confirmer l’envoi
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
        </div>

        <RappelsOperationsAdherentSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSelect={handleSelectAdherent}
          title="Sélectionner l’adhérent pour les opérations"
          description="Recherchez un adhérent par nom ou prénom (au moins 2 caractères)."
        />

        <Card className="shadow-md border-teal-200 dark:border-teal-800 pt-0 pb-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-teal-500/90 to-teal-600/90 text-white rounded-t-lg px-3 sm:px-4 lg:px-5 py-2.5 gap-1">
            <CardTitle className="text-white text-base sm:text-lg">
              Historique des envois
            </CardTitle>
            <CardDescription className="text-teal-100">
              « {RAPPEL_DETTE_EMAIL_ACCEPTED_UI_LABEL} »
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 lg:px-5 py-3">
            {!selected ? (
              <p className="text-sm text-slate-600">Sélectionnez un adhérent.</p>
            ) : envoisState.kind === "loading" ? (
              <div className="flex items-center gap-2 text-sm text-slate-600 py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement de l’historique…
              </div>
            ) : envoisState.kind === "source_unavailable" ? (
              <p
                role="status"
                className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
              >
                {RAPPEL_DETTE_SOURCE_UNAVAILABLE_UI}
              </p>
            ) : envoisState.kind === "error" ? (
              <p role="alert" className="text-sm text-red-700">
                {envoisState.message}
              </p>
            ) : envoisState.kind === "empty" ? (
              <p className="text-sm text-slate-600">
                Aucun envoi pour cet adhérent.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-md border border-slate-200">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="bg-teal-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 font-bold text-center">
                          Réservation
                        </th>
                        <th className="px-2 py-2 font-bold text-center">Email</th>
                        <th className="px-2 py-2 font-bold text-center">Notif</th>
                        <th className="px-2 py-2 font-bold text-center">
                          Montant
                        </th>
                        <th className="px-2 py-2 font-bold text-center">
                          Réservé le
                        </th>
                        <th className="px-2 py-2 font-bold text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {envois.map((row) => (
                        <tr
                          key={row.id}
                          className="border-t border-slate-100 odd:bg-white even:bg-slate-50/80"
                        >
                          <td className="px-2 py-2">
                            {row.reservationStatus}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-col gap-0.5">
                              <span>{row.emailStatus}</span>
                              {row.emailAcceptedMeaning ? (
                                <span className="text-[10px] text-slate-500">
                                  {RAPPEL_DETTE_EMAIL_ACCEPTED_UI_LABEL}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-2">{row.notifStatus}</td>
                          <td className="px-2 py-2 tabular-nums text-right">
                            {formatPreviewEuroAmount(row.detteNette)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {formatOperationsDateTime(row.reservedAt)}
                          </td>
                          <td className="px-2 py-2">
                            {row.canResumeNotif ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                  resumeBusyId === row.id ||
                                  !envoiMutationsAllowed
                                }
                                onClick={() => void handleResumeNotif(row)}
                                className="h-7 text-xs border-teal-300"
                              >
                                {resumeBusyId === row.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Reprendre notif"
                                )}
                              </Button>
                            ) : row.notifResumeEligible &&
                              !row.canResumeNotif ? (
                              <span className="text-[10px] text-amber-700">
                                Éligible métier — flag envoi off
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {envoisHasMore ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    disabled={envoisMoreBusy || !envoisCursor}
                    onClick={() =>
                      selected &&
                      void loadEnvois(selected.id, envoisCursor, true)
                    }
                  >
                    {envoisMoreBusy ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Page suivante
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-cyan-200 dark:border-cyan-800 pt-0 pb-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-cyan-500/90 to-cyan-600/90 text-white rounded-t-lg px-3 sm:px-4 lg:px-5 py-2.5">
            <CardTitle className="flex items-center gap-2 text-white text-base sm:text-lg">
              <Snowflake className="h-5 w-5" />
              Gels
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 lg:px-5 py-3 space-y-3">
            <p
              role="note"
              className="text-xs rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-cyan-950"
            >
              {RAPPEL_DETTE_GEL_NON_RETROACTIF_MESSAGE}
            </p>

            {selected ? (
              <Button
                type="button"
                variant="outline"
                disabled={!gelMutationsAllowed}
                onClick={() => {
                  setPoseError(null);
                  setPoseMotifCode(undefined);
                  setPoseMotifTexte("");
                  setPoseConfirmChecked(false);
                  setPoseOpen(true);
                }}
                className="border-cyan-300 hover:bg-cyan-50"
              >
                <Ban className="h-4 w-4 mr-2" />
                Poser un gel (adhérent)
              </Button>
            ) : null}

            {!selected ? (
              <p className="text-sm text-slate-600">Sélectionnez un adhérent.</p>
            ) : gelsState.kind === "loading" ? (
              <div className="flex items-center gap-2 text-sm text-slate-600 py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chargement des gels…
              </div>
            ) : gelsState.kind === "source_unavailable" ? (
              <p
                role="status"
                className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
              >
                {RAPPEL_DETTE_SOURCE_UNAVAILABLE_UI}
              </p>
            ) : gelsState.kind === "error" ? (
              <p role="alert" className="text-sm text-red-700">
                {gelsState.message}
              </p>
            ) : gelsState.kind === "empty" ? (
              <p className="text-sm text-slate-600">
                Aucun gel pour cet adhérent.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-md border border-slate-200">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="bg-cyan-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 font-bold text-center">
                          Statut
                        </th>
                        <th className="px-2 py-2 font-bold text-center">
                          Portée
                        </th>
                        <th className="px-2 py-2 font-bold text-center">Motif</th>
                        <th className="px-2 py-2 font-bold text-center">
                          Posé le
                        </th>
                        <th className="px-2 py-2 font-bold text-center">
                          Levé le
                        </th>
                        <th className="px-2 py-2 font-bold text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {gels.map((row) => (
                        <tr
                          key={row.id}
                          className="border-t border-slate-100 odd:bg-white even:bg-slate-50/80"
                        >
                          <td className="px-2 py-2">{row.statut}</td>
                          <td className="px-2 py-2">
                            {row.scope}
                            {row.lineLabel ? (
                              <span className="block text-[10px] text-slate-500">
                                {row.lineLabel}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            <span className="font-medium font-sans text-sm text-slate-900">
                              {formatRappelDetteGelMotifLabel(row.motifCode)}
                            </span>
                            <span className="block text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {row.motifTexte}
                            </span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {formatOperationsDateTime(row.posedAt)}
                            <span className="block text-[10px] text-slate-500">
                              {row.poseParLabel}
                            </span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {formatOperationsDateTime(row.leveAt)}
                            {row.leveParLabel ? (
                              <span className="block text-[10px] text-slate-500">
                                {row.leveParLabel}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2">
                            {row.statut === "ACTIF" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!gelMutationsAllowed}
                                onClick={() => setLeveTarget(row)}
                                className="h-7 text-xs border-cyan-300"
                              >
                                Lever
                              </Button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {gelsHasMore ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    disabled={gelsMoreBusy || !gelsCursor}
                    onClick={() =>
                      selected && void loadGels(selected.id, gelsCursor, true)
                    }
                  >
                    {gelsMoreBusy ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Page suivante
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={poseOpen} onOpenChange={setPoseOpen}>
          <DialogContent className="sm:max-w-md font-sans">
            <DialogHeader>
              <DialogTitle className="font-sans text-base sm:text-lg text-slate-900">
                Poser un gel adhérent
              </DialogTitle>
              <DialogDescription className="font-sans text-sm leading-relaxed text-slate-700">
                Motif obligatoire. {RAPPEL_DETTE_GEL_NON_RETROACTIF_MESSAGE}
              </DialogDescription>
            </DialogHeader>
            <div className={OPS_DIALOG_BODY_CLASS}>
              <div className="space-y-1.5">
                <Label htmlFor="pose-motif-code" className={OPS_DIALOG_LABEL_CLASS}>
                  Motif
                </Label>
                <Select
                  value={poseMotifCode}
                  onValueChange={(v) => setPoseMotifCode(v as MotifCode)}
                >
                  <SelectTrigger
                    id="pose-motif-code"
                    className="w-full font-sans text-sm sm:text-base"
                  >
                    <SelectValue placeholder="Choisir un motif" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONTESTATION">Contestation</SelectItem>
                    <SelectItem value="VERIFICATION_ADMINISTRATIVE">
                      Vérification administrative
                    </SelectItem>
                    <SelectItem value="AUTRE">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="pose-motif-texte"
                  className={OPS_DIALOG_LABEL_CLASS}
                >
                  Commentaire (obligatoire)
                </Label>
                <Input
                  id="pose-motif-texte"
                  value={poseMotifTexte}
                  onChange={(e) => setPoseMotifTexte(e.target.value)}
                  maxLength={500}
                  aria-required
                  className="font-sans text-sm sm:text-base"
                />
              </div>
              <div className={OPS_CONFIRM_ZONE_CLASS}>
                <Checkbox
                  id="pose-confirm"
                  checked={poseConfirmChecked}
                  onCheckedChange={(v) => setPoseConfirmChecked(v === true)}
                  disabled={poseBusy}
                  className={OPS_CONFIRM_CHECKBOX_CLASS}
                />
                <Label htmlFor="pose-confirm" className={OPS_CONFIRM_LABEL_CLASS}>
                  Je confirme la pose de ce gel pour l’adhérent sélectionné.
                </Label>
              </div>
              {poseError ? (
                <p role="alert" className="text-sm text-red-700 leading-relaxed">
                  {poseError}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPoseOpen(false)}
                disabled={poseBusy}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={() => void handlePose()}
                disabled={
                  poseBusy ||
                  !gelMutationsAllowed ||
                  !poseConfirmChecked ||
                  !poseMotifCode ||
                  !poseMotifTexte.trim()
                }
              >
                {poseBusy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirmer la pose
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={leveTarget != null}
          onOpenChange={(open) => {
            if (!open) setLeveTarget(null);
          }}
        >
          <DialogContent className="sm:max-w-md font-sans">
            <DialogHeader>
              <DialogTitle className="font-sans text-base sm:text-lg text-slate-900">
                Lever le gel
              </DialogTitle>
              <DialogDescription className="font-sans text-sm leading-relaxed text-slate-700">
                La levée enregistre l’acteur et la date. Aucun nouveau motif
                n’est demandé ni stocké.
              </DialogDescription>
            </DialogHeader>
            {leveTarget ? (
              <p className="font-sans text-sm sm:text-base leading-relaxed text-slate-800">
                Gel {leveTarget.id} —{" "}
                {formatRappelDetteGelMotifLabel(leveTarget.motifCode)} (posé le{" "}
                {formatOperationsDateTime(leveTarget.posedAt)})
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLeveTarget(null)}
                disabled={leveBusy}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={() => void handleLeve()}
                disabled={leveBusy || !gelMutationsAllowed}
              >
                {leveBusy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Confirmer la levée
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
