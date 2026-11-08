"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { fr } from "date-fns/locale";
import { format } from "date-fns";
import {
  Calendar,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  Search,
  MoreHorizontal,
  Home,
  UtensilsCrossed,
  Building2,
  Mail,
  User,
  FileText,
  ArrowLeft,
  ArrowUpDown,
  RefreshCw,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  getAllReunionsMensuelles,
  createReunionMensuelle,
  updateReunionMensuelle,
  deleteReunionMensuelle,
  validerMoisReunion,
  getReunionMensuelleById,
  adminSetParticipationsReunion,
  getAdherentsPourReunionParticipants,
} from "@/actions/reunions-mensuelles";
import { StatutReunionMensuelle, TypeLieuReunion, StatutParticipationReunion } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { InlineAdherentSearchPanel } from "@/components/admin/InlineAdherentSearchPanel";
import { isReunionPast } from "@/lib/services/reunions/reunion-helpers";
import {
  buildParticipantsState,
  countListParticipationBadges,
  countParticipationStats,
  hasUnsavedParticipantsEdits,
  isParticipantsLoadGenerationCurrent,
  nextParticipantsLoadGeneration,
  raceParticipantsLoadWithTimeout,
  NON_REPONDU_PERIMETER_HINT,
  PARTICIPANTS_DIALOG_LOAD_TIMEOUT_MESSAGE,
  PARTICIPANTS_REFRESH_DISCARD_MESSAGE,
  type ParticipantAdherentRow,
  type ParticipantsLoadGeneration,
} from "@/lib/services/reunions/participants-dialog-state";

const columnHelper = createColumnHelper<any>();

const moisOptions = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

function dateToUtcNoonIso(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)).toISOString();
}

export default function AdminReunionsMensuellesPage() {
  const [reunions, setReunions] = useState<any[]>([]);
  const [adherents, setAdherents] = useState<ParticipantAdherentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReunion, setEditingReunion] = useState<any | null>(null);
  const [adherentSearchOpen, setAdherentSearchOpen] = useState(false);
  const [selectedAdherent, setSelectedAdherent] = useState<any | null>(null);
  const [adherentComboboxOpen, setAdherentComboboxOpen] = useState(false);
  const [formData, setFormData] = useState({
    annee: new Date().getFullYear(),
    mois: new Date().getMonth() + 1,
    adherentHoteId: "",
  });
  const [editFormData, setEditFormData] = useState({
    dateReunion: "",
    typeLieu: "Domicile" as TypeLieuReunion,
    adresse: "",
    nomRestaurant: "",
    commentaires: "",
    adherentHoteId: "",
  });
  const [editSelectedDate, setEditSelectedDate] = useState<Date | undefined>(undefined);
  const [originalDateIso, setOriginalDateIso] = useState("");
  const [selectedEditAdherent, setSelectedEditAdherent] = useState<any | null>(null);
  const [adherentSearchEditOpen, setAdherentSearchEditOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [anneeCartes, setAnneeCartes] = useState(new Date().getFullYear());
  const [participantsDialogReunion, setParticipantsDialogReunion] = useState<any | null>(null);
  const [participantsDialogLoading, setParticipantsDialogLoading] = useState(false);
  /** true seulement après un chargement réussi pour la génération courante — bloque Enregistrer sinon */
  const [participantsDialogReady, setParticipantsDialogReady] = useState(false);
  const [participantsEdits, setParticipantsEdits] = useState<Record<string, { statut: StatutParticipationReunion; justificatifFournit: boolean }>>({});
  /** État serveur à l'ouverture : distingue ligne absente vs ligne NonRepondu */
  const [participantsInitial, setParticipantsInitial] = useState<
    Record<
      string,
      | { kind: "absent" }
      | { kind: "row"; statut: StatutParticipationReunion; justificatifFournit: boolean }
    >
  >({});
  const [participantsSearch, setParticipantsSearch] = useState("");
  const [participantsSort, setParticipantsSort] = useState<{ key: "adherent" | "statut"; direction: "asc" | "desc" }>({
    key: "adherent",
    direction: "asc",
  });
  const [listRefreshing, setListRefreshing] = useState(false);
  const [participantsRefreshing, setParticipantsRefreshing] = useState(false);
  /** Génération de chargement (réunion + seq) — les réponses obsolètes sont ignorées. */
  const participantsLoadSeqRef = useRef(0);
  const participantsLoadGenRef = useRef<ParticipantsLoadGeneration | null>(null);
  /** Miroir ref du loading pour garde anti-concurrence sans recréer le callback. */
  const participantsDialogLoadingRef = useRef(false);
  const adherentsRef = useRef(adherents);
  useEffect(() => {
    adherentsRef.current = adherents;
  }, [adherents]);
  /** Confirmation avant actualisation qui abandonnerait des edits locaux. */
  const [refreshConfirmScope, setRefreshConfirmScope] = useState<
    null | "list" | "participants"
  >(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [reunionsResult, adherentsResult] = await Promise.all([
        getAllReunionsMensuelles(),
        getAdherentsPourReunionParticipants(),
      ]);

      if (reunionsResult.success && reunionsResult.data) {
        setReunions(reunionsResult.data);
      } else {
        console.error("Erreur getAllReunionsMensuelles:", reunionsResult.error);
        toast.error(reunionsResult.error || "Erreur lors du chargement des réunions");
      }

      if (adherentsResult.success && adherentsResult.adherents) {
        setAdherents(adherentsResult.adherents as ParticipantAdherentRow[]);
      } else if (!adherentsResult.success) {
        toast.error(adherentsResult.error || "Erreur lors du chargement des adhérents");
      }
    } catch (error) {
      console.error("Erreur dans loadData:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const participantsDirty = useMemo(
    () =>
      !!participantsDialogReunion &&
      hasUnsavedParticipantsEdits(participantsInitial, participantsEdits),
    [participantsDialogReunion, participantsInitial, participantsEdits]
  );

  const hasUnsavedAdminWork = useMemo(
    () => participantsDirty || !!editingReunion || showForm,
    [participantsDirty, editingReunion, showForm]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await createReunionMensuelle({
        annee: formData.annee,
        mois: formData.mois,
        adherentHoteId: formData.adherentHoteId,
      });

      if (result.success) {
        toast.success("Réunion mensuelle créée avec succès");
        setShowForm(false);
        setFormData({
          annee: new Date().getFullYear(),
          mois: new Date().getMonth() + 1,
          adherentHoteId: "",
        });
        setSelectedAdherent(null);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la création");
      }
    } catch (error) {
      toast.error("Erreur lors de la création de la réunion");
    } finally {
      setLoading(false);
    }
  };

  const handleValiderMois = async (reunionId: string) => {
    if (!confirm("Valider la réunion ? L'hôte a choisi la date ; la réunion sera marquée comme confirmée.")) {
      return;
    }

    setLoading(true);
    try {
      const result = await validerMoisReunion(reunionId);
      if (result.success) {
        toast.success("Réunion validée.");
        setEditingReunion(null);
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la validation");
      }
    } catch (error) {
      toast.error("Erreur lors de la validation");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingReunion) return;

    setLoading(true);
    try {
      const result = await updateReunionMensuelle({
        id: editingReunion.id,
        ...editFormData,
        dateReunion:
          editFormData.dateReunion && editFormData.dateReunion !== originalDateIso
            ? editFormData.dateReunion
            : undefined,
        adherentHoteId: editFormData.adherentHoteId || undefined,
      });

      if (result.success) {
        toast.success("Réunion mise à jour avec succès");
        setEditingReunion(null);
        setEditFormData({
          dateReunion: "",
          typeLieu: "Domicile",
          adresse: "",
          nomRestaurant: "",
          commentaires: "",
          adherentHoteId: "",
        });
        setSelectedEditAdherent(null);
        setEditSelectedDate(undefined);
        setOriginalDateIso("");
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette réunion ?")) {
      return;
    }

    setLoading(true);
    try {
      const result = await deleteReunionMensuelle(id);
      if (result.success) {
        toast.success("Réunion supprimée");
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = async (reunion: any) => {
    const initialIso = reunion.dateReunion ? new Date(reunion.dateReunion).toISOString() : "";
    setAdherentSearchEditOpen(false);
    setEditingReunion(reunion);
    setSelectedEditAdherent(reunion.AdherentHote || null);
    setEditSelectedDate(reunion.dateReunion ? new Date(reunion.dateReunion) : undefined);
    setOriginalDateIso(initialIso);
    setEditFormData({
      dateReunion: initialIso,
      typeLieu: reunion.typeLieu || "Domicile",
      adresse: reunion.adresse || "",
      nomRestaurant: reunion.nomRestaurant || "",
      commentaires: reunion.commentaires || "",
      adherentHoteId: reunion.adherentHoteId || "",
    });
  };

  const getStatutBadge = (statut: string) => {
    const badges: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      EnAttente: { label: "En attente", variant: "outline" },
      MoisValide: { label: "Mois validé", variant: "secondary" },
      DateConfirmee: { label: "Date confirmée", variant: "default" },
      Annulee: { label: "Annulée", variant: "destructive" },
    };
    return badges[statut] || { label: statut, variant: "outline" };
  };

  const isReunionPassee = (reunion: any) =>
    isReunionPast(reunion?.dateReunion ? new Date(reunion.dateReunion) : null);

  const getStatutBadgeForReunion = (reunion: any) => {
    const badge = getStatutBadge(reunion?.statut);
    if (reunion?.statut === "DateConfirmee" && isReunionPassee(reunion)) {
      return {
        label: "Réunion passée",
        variant: "secondary" as const,
        className: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
      };
    }
    return { ...badge, className: "" };
  };

  const getTypeLieuIcon = (type: string) => {
    switch (type) {
      case "Domicile":
        return <Home className="h-4 w-4" />;
      case "Restaurant":
        return <UtensilsCrossed className="h-4 w-4" />;
      case "Autre":
        return <Building2 className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  /**
   * Ferme le dialogue participants : invalide la génération en cours et
   * réinitialise loading / ready. N'annule pas un POST Server Action déjà parti.
   */
  const closeParticipantsDialog = useCallback(() => {
    participantsLoadSeqRef.current += 1;
    participantsLoadGenRef.current = null;
    participantsDialogLoadingRef.current = false;
    setParticipantsDialogLoading(false);
    setParticipantsRefreshing(false);
    setParticipantsDialogReady(false);
    setParticipantsDialogReunion(null);
    setParticipantsEdits({});
    setParticipantsInitial({});
    setRefreshConfirmScope((scope) =>
      scope === "participants" ? null : scope
    );
  }, []);

  /**
   * Charge / recharge le dialogue participants (lecture seule serveur).
   * Génération liée à la réunion : réponses obsolètes ignorées.
   * Timeout UI borné — ne prétend pas annuler le POST serveur.
   *
   * @param reunion - Réunion cible
   * @param options.resetFilters - Si true (ouverture), réinitialise recherche/tri
   * @param options.closeOnError - Fermer le dialogue en cas d'échec (ouverture)
   * @param options.manualToast - Toast succès uniquement après clic Actualiser
   */
  const loadParticipantsDialogData = useCallback(
    async (
      reunion: { id: string },
      options: {
        resetFilters?: boolean;
        closeOnError?: boolean;
        manualToast?: boolean;
        /** Conflit : garder les edits jusqu'aux données fraîches (ready=false bloque la sauvegarde). */
        preserveEditsUntilFresh?: boolean;
      } = {}
    ) => {
      const {
        resetFilters = false,
        closeOnError = false,
        manualToast = false,
        preserveEditsUntilFresh = false,
      } = options;

      // Même réunion déjà en chargement : pas de relance concurrente / boucle
      if (
        participantsDialogLoadingRef.current &&
        participantsLoadGenRef.current?.reunionId === reunion.id
      ) {
        return false;
      }

      const gen = nextParticipantsLoadGeneration(
        participantsLoadSeqRef.current,
        reunion.id
      );
      participantsLoadSeqRef.current = gen.seq;
      participantsLoadGenRef.current = gen;

      // Bloquer toute sauvegarde pendant le rechargement
      setParticipantsDialogReady(false);
      if (!preserveEditsUntilFresh) {
        setParticipantsEdits({});
        setParticipantsInitial({});
      }
      participantsDialogLoadingRef.current = true;
      setParticipantsDialogLoading(true);
      if (resetFilters) {
        setParticipantsSearch("");
        setParticipantsSort({ key: "adherent", direction: "asc" });
      }

      const stillCurrent = () =>
        isParticipantsLoadGenerationCurrent(participantsLoadGenRef.current, gen);

      try {
        // Timeout = déblocage UI uniquement ; le/les POST continuent côté serveur.
        const raced = await raceParticipantsLoadWithTimeout(
          Promise.all([
            getReunionMensuelleById(reunion.id),
            getAdherentsPourReunionParticipants(),
          ])
        );

        if (!stillCurrent()) {
          return false;
        }

        if (raced.status === "timeout") {
          toast.error(PARTICIPANTS_DIALOG_LOAD_TIMEOUT_MESSAGE);
          setParticipantsDialogReady(false);
          if (closeOnError) {
            closeParticipantsDialog();
          }
          return false;
        }

        const [fresh, adherentsReload] = raced.value;

        if (!fresh.success || !fresh.data) {
          toast.error(fresh.error || "Impossible de charger les participants");
          setParticipantsDialogReady(false);
          if (closeOnError) closeParticipantsDialog();
          return false;
        }

        let adherentsList = adherentsRef.current;
        if (adherentsReload.success && adherentsReload.adherents) {
          adherentsList = adherentsReload.adherents as ParticipantAdherentRow[];
        } else if (adherentsList.length === 0) {
          toast.error(
            adherentsReload.error || "Impossible de charger les adhérents"
          );
          setParticipantsDialogReady(false);
          if (closeOnError) closeParticipantsDialog();
          return false;
        }

        if (!stillCurrent()) {
          return false;
        }

        const { initial, edits, merged } = buildParticipantsState(
          fresh.data.Participations || [],
          adherentsList
        );
        // Reconstruit expected (initial) + edits depuis les données fraîches
        setAdherents(merged);
        setParticipantsInitial(initial as typeof participantsInitial);
        setParticipantsEdits(edits as typeof participantsEdits);
        setParticipantsDialogReunion(fresh.data);
        setParticipantsDialogReady(true);
        setReunions((prev) =>
          prev.map((r) =>
            r.id === fresh.data.id
              ? { ...r, Participations: fresh.data.Participations }
              : r
          )
        );
        if (manualToast) {
          toast.success("Participants actualisés");
        }
        return true;
      } catch (e) {
        console.error(e);
        if (!stillCurrent()) return false;
        toast.error("Erreur lors du chargement des participants");
        setParticipantsDialogReady(false);
        if (closeOnError) closeParticipantsDialog();
        return false;
      } finally {
        // Ne pas éteindre le loader si une génération plus récente l'a repris
        if (stillCurrent()) {
          participantsDialogLoadingRef.current = false;
          setParticipantsDialogLoading(false);
        }
      }
    },
    [closeParticipantsDialog]
  );

  const openParticipantsDialog = useCallback(
    async (reunion: any) => {
      // Titre immédiat ; compteurs/lignes masqués tant que loading (pas d'anciens badges)
      setParticipantsDialogReunion(reunion);
      setParticipantsDialogReady(false);
      setParticipantsEdits({});
      setParticipantsInitial({});
      await loadParticipantsDialogData(reunion, {
        resetFilters: true,
        closeOnError: true,
      });
    },
    [loadParticipantsDialogData]
  );

  /**
   * Actualise la liste des réunions + compteurs sans perdre année / recherche.
   * Lecture seule — aucune écriture DB ni émission.
   */
  const refreshReunionsList = useCallback(async () => {
    if (listRefreshing) return;
    setListRefreshing(true);
    try {
      const [reunionsResult, adherentsResult] = await Promise.all([
        getAllReunionsMensuelles(),
        getAdherentsPourReunionParticipants(),
      ]);
      if (!reunionsResult.success || !reunionsResult.data) {
        toast.error(
          reunionsResult.error || "Erreur lors de l'actualisation des réunions"
        );
        return;
      }
      setReunions(reunionsResult.data);
      if (adherentsResult.success && adherentsResult.adherents) {
        setAdherents(adherentsResult.adherents as ParticipantAdherentRow[]);
      }
      // Formulaire édition / création : abandonné si confirmation déjà acceptée
      setEditingReunion(null);
      setShowForm(false);
      // Dialogue ouvert : reconstruire expected depuis la réunion fraîche
      if (participantsDialogReunion?.id) {
        const match = reunionsResult.data.find(
          (r: { id: string }) => r.id === participantsDialogReunion.id
        );
        await loadParticipantsDialogData(
          match ?? participantsDialogReunion,
          { resetFilters: false, manualToast: false }
        );
      }
      toast.success("Liste des réunions actualisée");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'actualisation des réunions");
    } finally {
      setListRefreshing(false);
    }
  }, [
    listRefreshing,
    participantsDialogReunion,
    loadParticipantsDialogData,
  ]);

  const refreshParticipantsDialog = useCallback(async () => {
    if (!participantsDialogReunion || participantsRefreshing) return;
    setParticipantsRefreshing(true);
    try {
      await loadParticipantsDialogData(participantsDialogReunion, {
        resetFilters: false,
        manualToast: true,
      });
    } finally {
      setParticipantsRefreshing(false);
    }
  }, [
    participantsDialogReunion,
    participantsRefreshing,
    loadParticipantsDialogData,
  ]);

  const requestRefreshReunionsList = () => {
    if (listRefreshing) return;
    if (hasUnsavedAdminWork) {
      setRefreshConfirmScope("list");
      return;
    }
    void refreshReunionsList();
  };

  const requestRefreshParticipantsDialog = () => {
    if (participantsRefreshing || participantsDialogLoading) return;
    if (participantsDirty) {
      setRefreshConfirmScope("participants");
      return;
    }
    void refreshParticipantsDialog();
  };

  const confirmPendingRefresh = () => {
    const scope = refreshConfirmScope;
    setRefreshConfirmScope(null);
    if (scope === "list") void refreshReunionsList();
    else if (scope === "participants") void refreshParticipantsDialog();
  };

  const toggleParticipantsSort = (key: "adherent" | "statut") => {
    setParticipantsSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const handleSaveParticipants = async () => {
    if (!participantsDialogReunion || !participantsDialogReady) return;
    if (participantsDialogLoading || participantsRefreshing) return;
    setLoading(true);
    try {
      // Delta uniquement + état attendu (absent vs row) pour comparaison atomique serveur
      const payloadParticipations = adherents
        .map((a) => {
          const edit = participantsEdits[a.id] ?? {
            statut: "NonRepondu" as StatutParticipationReunion,
            justificatifFournit: false,
          };
          const initial = participantsInitial[a.id] ?? { kind: "absent" as const };
          const initialStatut =
            initial.kind === "absent" ? ("NonRepondu" as StatutParticipationReunion) : initial.statut;
          const initialJustificatif =
            initial.kind === "absent" ? false : initial.justificatifFournit;
          const changed =
            edit.statut !== initialStatut ||
            Boolean(edit.justificatifFournit) !== Boolean(initialJustificatif);
          if (!changed) return null;
          return {
            adherentId: a.id,
            statut: edit.statut,
            justificatifFournit: Boolean(edit.justificatifFournit),
            expected:
              initial.kind === "absent"
                ? ({ kind: "absent" } as const)
                : ({
                    kind: "row" as const,
                    statut: initial.statut,
                    justificatifFournit: Boolean(initial.justificatifFournit),
                  }),
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (payloadParticipations.length === 0) {
        toast.info("Aucune modification détectée.");
        setLoading(false);
        return;
      }

      const result = await adminSetParticipationsReunion({
        reunionId: participantsDialogReunion.id,
        participations: payloadParticipations,
      });

      if (result.success) {
        const totals = countParticipationStats(adherents, participantsEdits);
        toast.success(
          `Participants enregistrés — Présents: ${totals.presents} | Absents: ${totals.absents} | Excusés: ${totals.excuses} | Non répondus: ${totals.nonRepondus}`
        );
        setParticipantsDialogReunion(null);
        await loadData();
      } else if ((result as { code?: string }).code === "CONFLICT") {
        toast.warning(
          result.error ||
            "Conflit : réponses mises à jour ailleurs. Rechargement…"
        );
        // ready=false immédiat ; edits obsolètes remplacés seulement si charge OK
        const reloaded = await loadParticipantsDialogData(
          participantsDialogReunion,
          {
            resetFilters: false,
            closeOnError: false,
            preserveEditsUntilFresh: true,
          }
        );
        if (!reloaded) {
          toast.error(
            "Impossible de recharger après conflit. Actualisez avant de réenregistrer."
          );
          // Empêcher une sauvegarde aveugle des anciennes valeurs
          setParticipantsDialogReady(false);
        }
      } else {
        toast.error(result.error || "Erreur lors de l'enregistrement des participants");
      }
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement des participants");
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("mois", {
        header: "Mois",
        cell: (info) => {
          const mois = info.getValue();
          return moisOptions.find((m) => m.value === mois)?.label || mois;
        },
      }),
      columnHelper.accessor("annee", {
        header: "Année",
      }),
      columnHelper.accessor("statut", {
        header: "Statut",
        cell: (info) => {
          const reunion = info.row.original;
          const statut = info.getValue();
          const badge = getStatutBadge(statut);
          const computed = getStatutBadgeForReunion(reunion);
          return <Badge variant={badge.variant} className={computed.className}>{computed.label}</Badge>;
        },
      }),
      columnHelper.accessor("AdherentHote", {
        header: "Hôte",
        cell: (info) => {
          const hote = info.getValue();
          return hote ? `${hote.firstname || ""} ${hote.lastname || ""}`.trim() : "-";
        },
      }),
      columnHelper.accessor("dateReunion", {
        header: "Date",
        cell: (info) => {
          const date = info.getValue();
          return date ? format(new Date(date), "dd/MM/yyyy", { locale: fr }) : "-";
        },
      }),
      columnHelper.accessor("typeLieu", {
        header: "Lieu",
        cell: (info) => {
          const type = info.getValue();
          const icon = getTypeLieuIcon(type);
          return (
            <div className="flex items-center gap-2">
              {icon}
              <span>{type || "Domicile"}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor("Rapport", {
        header: "Compte rendu",
        cell: (info) => {
          const rapport = info.getValue() as {
            id: string;
            titre?: string;
            statut?: string;
          } | null;
          if (!rapport?.id) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          const published = rapport.statut === "PUBLISHED";
          return (
            <a
              href={`/admin/rapports-reunion?view=${encodeURIComponent(rapport.id)}`}
              className="inline-flex flex-col items-start gap-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
            >
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {published ? "Compte rendu disponible" : "Brouillon"}
              </span>
            </a>
          );
        },
      }),
      columnHelper.accessor("Participations", {
        header: "Participants",
        cell: (info) => {
          const reunion = info.row.original;
          const participations = info.getValue() || [];
          const { presents, absents, excuses } =
            countListParticipationBadges(participations);
          const canViewList = reunion.statut === "DateConfirmee";
          return (
            <button
              type="button"
              onClick={() => canViewList && openParticipantsDialog(reunion)}
              className={cn(
                "flex items-center gap-2 text-xs text-left rounded px-1 py-0.5 -mx-1",
                canViewList && "hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              )}
              title={canViewList ? "Voir la liste des participants" : undefined}
              disabled={!canViewList}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span className="text-green-600">{presents}</span>
              <span className="text-gray-400">/</span>
              <span className="text-red-600">{absents}</span>
              <span className="text-gray-400">/</span>
              <span className="text-orange-600">{excuses}</span>
              {canViewList && <span className="text-blue-600 dark:text-blue-400 text-[10px] ml-1">(voir)</span>}
            </button>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const reunion = info.row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditDialog(reunion)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                {reunion.statut === "DateConfirmee" && (
                  <DropdownMenuItem onClick={() => openParticipantsDialog(reunion)}>
                    <Users className="h-4 w-4 mr-2" />
                    Voir participants
                  </DropdownMenuItem>
                )}
                {reunion.statut === "EnAttente" && (
                  <DropdownMenuItem
                    onClick={() => reunion.dateReunion && handleValiderMois(reunion.id)}
                    disabled={!reunion.dateReunion}
                    title={!reunion.dateReunion ? "L'hôte doit d'abord choisir la date (samedi) avant validation." : undefined}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Valider la réunion
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => handleDelete(reunion.id)}
                  disabled={reunion.statut === "DateConfirmee"}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    [openParticipantsDialog]
  );

  const filteredData = useMemo(() => {
    return reunions.filter((reunion) => {
      if (globalFilter.trim()) {
        const q = globalFilter.toLowerCase();
        const searchText = [
          moisOptions.find((m) => m.value === reunion.mois)?.label || "",
          reunion.annee.toString(),
          reunion.AdherentHote?.firstname || "",
          reunion.AdherentHote?.lastname || "",
          reunion.statut || "",
        ]
          .join(" ")
          .toLowerCase();
        return searchText.includes(q);
      }
      return true;
    });
  }, [reunions, globalFilter]);

  const reunionsParMois = useMemo(() => {
    const map = new Map<number, any>();
    reunions.forEach((r) => {
      if (r.annee === anneeCartes) {
        map.set(r.mois, r);
      }
    });
    return map;
  }, [reunions, anneeCartes]);

  const handleClickCarteMois = (mois: number) => {
    const reunion = reunionsParMois.get(mois);
    if (reunion) {
      openEditDialog(reunion);
    } else {
      setFormData({
        annee: anneeCartes,
        mois,
        adherentHoteId: "",
      });
      setSelectedAdherent(null);
      setShowForm(true);
    }
  };

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  if (loading && reunions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800 p-3 sm:p-4 lg:p-6 font-sans">
      <div className="w-full mb-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </Button>
      </div>
      <Card className="w-full shadow-lg border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-4 w-4" />
              Gestion des Réunions Mensuelles ({reunions.length})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={requestRefreshReunionsList}
                disabled={listRefreshing || loading}
                aria-label="Actualiser la liste des réunions et les compteurs"
                className="bg-white/10 text-white border-white/40 hover:bg-white/20 hover:text-white"
              >
                {listRefreshing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
                )}
                Actualiser
              </Button>
              <Button
                onClick={() => {
                  setEditingReunion(null);
                  setFormData({
                    annee: new Date().getFullYear(),
                    mois: new Date().getMonth() + 1,
                    adherentHoteId: "",
                  });
                  setSelectedAdherent(null);
                  setShowForm(true);
                }}
                className="bg-white text-blue-600 hover:bg-blue-50 border-white shadow-sm font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle réunion
              </Button>
            </div>
          </div>
          <CardDescription className="text-blue-100 text-xs pb-3">
            Gérez les réunions mensuelles : cliquez sur un mois pour créer une réunion (choisir l&apos;hôte) ou modifier / changer l&apos;hôte.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Label className="text-sm font-medium">Année</Label>
              <Input
                type="number"
                min="2020"
                max="2100"
                value={anneeCartes}
                onChange={(e) => setAnneeCartes(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-24"
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Cliquez sur un mois pour créer une réunion (choisir l&apos;hôte) ou modifier.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
              {moisOptions.map((mois) => {
                const reunion = reunionsParMois.get(mois.value);
                const badge = reunion ? getStatutBadgeForReunion(reunion) : null;
                return (
                  <Card
                    key={mois.value}
                    className={`border-2 cursor-pointer transition-all hover:shadow-md ${
                      reunion
                        ? reunion.statut === "DateConfirmee"
                          ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                          : reunion.statut === "MoisValide"
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                          : "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30"
                        : "border-gray-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    }`}
                    onClick={() => handleClickCarteMois(mois.value)}
                  >
                    <CardContent className="p-3 text-center">
                      <h3 className="font-semibold text-sm">{mois.label}</h3>
                      {reunion ? (
                        <>
                          {badge && (
                            <Badge variant={badge.variant} className={`text-xs mt-1 ${badge.className}`}>
                              {badge.label}
                            </Badge>
                          )}
                          {reunion.AdherentHote && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate" title={`${reunion.AdherentHote.firstname} ${reunion.AdherentHote.lastname}`}>
                              Hôte: {reunion.AdherentHote.firstname} {reunion.AdherentHote.lastname}
                            </p>
                          )}
                          {reunion.Rapport?.id ? (
                            <a
                              href={`/admin/rapports-reunion?view=${encodeURIComponent(reunion.Rapport.id)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1.5 inline-flex items-center justify-center gap-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-blue-700"
                            >
                              <FileText className="h-3 w-3" aria-hidden />
                              {reunion.Rapport.statut === "PUBLISHED"
                                ? "Compte rendu disponible"
                                : "Brouillon"}
                            </a>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">Créer</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-2">Liste des réunions</h3>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
                <Input
                  placeholder="Rechercher par mois, année, hôte..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-10 sm:pl-10 font-sans"
                />
              </div>
            </div>
            <DataTable table={table} emptyMessage="Aucune réunion mensuelle trouvée" />
          </div>

          {/* Dialog : Créer une réunion */}
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="max-w-lg p-0 gap-0 border-2 border-blue-200 dark:border-blue-800">
              <DialogHeader className="rounded-t-lg -mx-0 -mt-0 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white border-b border-blue-400/30">
                <DialogTitle className="text-base">Nouvelle réunion mensuelle</DialogTitle>
                <DialogDescription className="text-blue-100 text-xs mt-0.5">
                  Créez une nouvelle réunion mensuelle. L'adhérent hôte pourra ensuite confirmer la date une fois le mois validé.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="annee">Année *</Label>
                    <Input
                      id="annee"
                      type="number"
                      min="2020"
                      max="2100"
                      value={formData.annee}
                      onChange={(e) => setFormData({ ...formData, annee: parseInt(e.target.value) || new Date().getFullYear() })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mois">Mois *</Label>
                    <Select
                      value={formData.mois.toString()}
                      onValueChange={(v) => setFormData({ ...formData, mois: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {moisOptions.map((m) => (
                          <SelectItem key={m.value} value={m.value.toString()}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Adhérent hôte *</Label>
                  <Popover open={adherentComboboxOpen} onOpenChange={setAdherentComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={adherentComboboxOpen}
                        className="w-full justify-between text-sm font-normal h-10"
                      >
                        <span className="truncate flex-1 text-left">
                          {selectedAdherent ? (
                            `${selectedAdherent.firstname} ${selectedAdherent.lastname}${selectedAdherent.email ? ` (${selectedAdherent.email})` : ""}`
                          ) : (
                            <span className="text-muted-foreground">Rechercher ou choisir l'adhérent hôte...</span>
                          )}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Rechercher par nom, prénom ou email..." />
                        <CommandList>
                          <CommandEmpty>Aucun adhérent trouvé.</CommandEmpty>
                          <CommandGroup>
                            {adherents.map((a) => {
                              const label = `${a.firstname} ${a.lastname}${a.email ? ` (${a.email})` : ""}`;
                              return (
                                <CommandItem
                                  key={a.id}
                                  value={`${a.firstname} ${a.lastname} ${a.email || ""}`}
                                  onSelect={() => {
                                    setFormData({ ...formData, adherentHoteId: a.id });
                                    setSelectedAdherent(a);
                                    setAdherentComboboxOpen(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Check className={cn("mr-2 h-4 w-4", formData.adherentHoteId === a.id ? "opacity-100" : "opacity-0")} />
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <span className="font-medium text-sm truncate">{a.firstname} {a.lastname}</span>
                                    {a.email && <span className="text-xs text-muted-foreground truncate">{a.email}</span>}
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <DialogFooter className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4 bg-slate-50/50 dark:bg-slate-900/50 -mx-4 -mb-4 px-4 pb-4">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={loading || !formData.adherentHoteId}>
                    Créer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Dialog : Modifier une réunion */}
          <Dialog open={!!editingReunion} onOpenChange={(open) => {
            if (!open) {
              setEditingReunion(null);
              setAdherentSearchEditOpen(false);
            }
          }}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0 border-2 border-blue-200 dark:border-blue-800">
              <DialogHeader className="rounded-t-lg -mx-0 -mt-0 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white border-b border-blue-400/30">
                <DialogTitle className="text-base">Modifier la réunion</DialogTitle>
                <DialogDescription className="text-blue-100 text-xs mt-0.5">
                  Modifiez les détails de la réunion. Vous pouvez changer l'hôte, confirmer la date, modifier le lieu.
                </DialogDescription>
              </DialogHeader>
              {editingReunion && (
                <div className="space-y-3 p-4">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-100 dark:border-blue-900">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Réunion {moisOptions.find((m) => m.value === editingReunion.mois)?.label} {editingReunion.annee}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                      Hôte : {editingReunion.AdherentHote?.firstname} {editingReunion.AdherentHote?.lastname}
                    </p>
                    <Badge className="mt-1.5" variant={getStatutBadge(editingReunion.statut).variant}>
                      {getStatutBadge(editingReunion.statut).label}
                    </Badge>
                  </div>

                  {editingReunion.statut === "EnAttente" && (
                    <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 space-y-1.5">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Valider la réunion
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {editingReunion.dateReunion
                          ? "L'hôte a choisi la date. Vous pouvez valider la réunion."
                          : "L'hôte doit d'abord choisir la date (samedi) dans le calendrier ci-dessous. Ensuite vous pourrez valider."}
                      </p>
                      <Button
                        type="button"
                        onClick={() => handleValiderMois(editingReunion.id)}
                        disabled={loading || !editingReunion.dateReunion}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Valider la réunion
                      </Button>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Adhérent hôte</Label>
                    <div className="flex gap-2">
                      <Input
                        value={selectedEditAdherent ? `${selectedEditAdherent.firstname} ${selectedEditAdherent.lastname}` : ""}
                        placeholder="Changer l'hôte"
                        readOnly
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAdherentSearchEditOpen((v) => !v)}
                      >
                        <User className="h-4 w-4 mr-2" />
                        {adherentSearchEditOpen ? "Fermer" : "Changer"}
                      </Button>
                    </div>
                    <InlineAdherentSearchPanel
                      open={adherentSearchEditOpen}
                      onOpenChange={setAdherentSearchEditOpen}
                      onSelect={(adherent) => {
                        setSelectedEditAdherent(adherent);
                        setEditFormData((prev) => ({ ...prev, adherentHoteId: adherent.id }));
                      }}
                      title="Changer l'adhérent hôte"
                      description="Choisissez le nouvel adhérent hôte pour cette réunion"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dateReunion" className="text-xs">Date de la réunion</Label>
                    <div className="rounded-md border p-1.5">
                      <CalendarUI
                        mode="single"
                        selected={editSelectedDate}
                        onSelect={(d) => {
                          setEditSelectedDate(d || undefined);
                          if (d) setEditFormData((prev) => ({ ...prev, dateReunion: dateToUtcNoonIso(d) }));
                          else setEditFormData((prev) => ({ ...prev, dateReunion: "" }));
                        }}
                        locale={fr}
                        disabled={(d) => {
                          if (!editingReunion) return true;
                          const sameMonth = d.getFullYear() === editingReunion.annee && d.getMonth() + 1 === editingReunion.mois;
                          const isSaturday = d.getDay() === 6;
                          return !sameMonth || !isSaturday;
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">Uniquement les samedis du mois sélectionné.</p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="typeLieu" className="text-xs">Type de lieu</Label>
                    <Select
                      value={editFormData.typeLieu}
                      onValueChange={(v) => setEditFormData({ ...editFormData, typeLieu: v as TypeLieuReunion })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Domicile">Domicile de l'hôte</SelectItem>
                        <SelectItem value="Restaurant">Restaurant</SelectItem>
                        <SelectItem value="Autre">Autre lieu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editFormData.typeLieu === "Restaurant" && (
                    <div className="space-y-1">
                      <Label htmlFor="nomRestaurant" className="text-xs">Nom du restaurant</Label>
                      <Input
                        id="nomRestaurant"
                        value={editFormData.nomRestaurant}
                        onChange={(e) => setEditFormData({ ...editFormData, nomRestaurant: e.target.value })}
                      />
                    </div>
                  )}

                  {(editFormData.typeLieu === "Autre" || editFormData.typeLieu === "Restaurant") && (
                    <div className="space-y-1">
                      <Label htmlFor="adresse" className="text-xs">Adresse</Label>
                      <Textarea
                        id="adresse"
                        value={editFormData.adresse}
                        onChange={(e) => setEditFormData({ ...editFormData, adresse: e.target.value })}
                        rows={2}
                        className="min-h-0 text-sm"
                        placeholder="Adresse complète du lieu de réunion"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="commentaires" className="text-xs">Commentaires</Label>
                    <Textarea
                      id="commentaires"
                      value={editFormData.commentaires}
                      onChange={(e) => setEditFormData({ ...editFormData, commentaires: e.target.value })}
                      rows={2}
                      className="min-h-0 text-sm"
                      placeholder="Commentaires additionnels..."
                    />
                  </div>

                  <DialogFooter className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <Button type="button" variant="outline" onClick={() => setEditingReunion(null)}>
                      Annuler
                    </Button>
                    <Button onClick={handleUpdate} disabled={loading}>
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Dialog : Liste des participants (à la demande) */}
          <Dialog
            open={!!participantsDialogReunion}
            onOpenChange={(open) => {
              if (!open) closeParticipantsDialog();
            }}
          >
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-2 border-blue-200 dark:border-blue-800 font-sans">
              <DialogHeader className="shrink-0 rounded-t-lg px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white border-b border-blue-400/30">
                <DialogTitle className="text-base">Liste des participants</DialogTitle>
                <DialogDescription className="text-blue-100 text-xs mt-0.5">
                  {participantsDialogReunion && (
                    <>Réunion {moisOptions.find((m) => m.value === participantsDialogReunion.mois)?.label} {participantsDialogReunion.annee}</>
                  )}
                </DialogDescription>
              </DialogHeader>
              {participantsDialogReunion && (() => {
                const participantsBusy =
                  participantsDialogLoading || participantsRefreshing;
                const showParticipantsBody =
                  participantsDialogReady && !participantsBusy;
                const stats = countParticipationStats(adherents, participantsEdits);
                const listAligned = countListParticipationBadges(
                  participantsDialogReunion.Participations || []
                );
                const q = participantsSearch.trim().toLowerCase();
                const visibleAdherents = !q
                  ? adherents
                  : adherents.filter((a) =>
                      `${a.firstname ?? ""} ${a.lastname ?? ""} ${a.email ?? ""}`
                        .toLowerCase()
                        .includes(q)
                    );

                return (
                  <>
                    <div className="shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-2">
                      {showParticipantsBody ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2 text-xs font-sans">
                            <Badge className="border border-green-300 bg-green-100 text-green-900 font-semibold">
                              Présent : {stats.presents}
                            </Badge>
                            <Badge className="border border-red-300 bg-red-100 text-red-900 font-semibold">
                              Absent : {stats.absents}
                            </Badge>
                            <Badge className="border border-amber-300 bg-amber-100 text-amber-950 font-semibold">
                              Excusé : {stats.excuses}
                            </Badge>
                            <Badge className="border border-slate-300 bg-slate-100 text-slate-800 font-semibold">
                              Non répondu : {stats.nonRepondus}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                            {NON_REPONDU_PERIMETER_HINT}
                            {stats.presents === listAligned.presents &&
                              stats.absents === listAligned.absents &&
                              stats.excuses === listAligned.excuses && (
                                <> Compteurs P/A/E alignés sur la liste (données fraîches).</>
                              )}
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                          {participantsBusy
                            ? "Chargement des compteurs et de la liste…"
                            : "Données non disponibles — utilisez Actualiser."}
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <div className="relative flex-1">
                          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
                          <Input
                            placeholder="Filtrer les participants…"
                            value={participantsSearch}
                            onChange={(e) => setParticipantsSearch(e.target.value)}
                            className="pl-10 sm:pl-10 h-9 font-sans"
                            disabled={participantsDialogLoading || participantsRefreshing || !participantsDialogReady}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={requestRefreshParticipantsDialog}
                          disabled={
                            participantsDialogLoading ||
                            participantsRefreshing ||
                            loading
                          }
                          aria-label="Actualiser les réponses et les compteurs des participants"
                          className="shrink-0"
                        >
                          {participantsRefreshing || participantsDialogLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
                          )}
                          Actualiser
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-auto flex-1 min-h-0">
                      {participantsBusy ? (
                        <div className="flex items-center justify-center py-12 text-sm text-slate-600">
                          Chargement des réponses…
                        </div>
                      ) : !participantsDialogReady ? (
                        <div className="flex items-center justify-center py-12 text-sm text-slate-600">
                          Impossible d&apos;afficher les participants. Réessayez via Actualiser.
                        </div>
                      ) : (
                        <table className="w-full text-sm border-collapse">
                          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                              <th className="text-left px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                                <button
                                  type="button"
                                  onClick={() => toggleParticipantsSort("adherent")}
                                  className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                  Adhérent
                                  <ArrowUpDown className="h-3.5 w-3.5" />
                                </button>
                              </th>
                              <th className="text-left px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                                <button
                                  type="button"
                                  onClick={() => toggleParticipantsSort("statut")}
                                  className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                  Statut
                                  <ArrowUpDown className="h-3.5 w-3.5" />
                                </button>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleAdherents
                              .map((a) => {
                                const currentStatut = (participantsEdits[a.id]?.statut ??
                                  "NonRepondu") as StatutParticipationReunion;
                                const currentJustificatif = Boolean(
                                  participantsEdits[a.id]?.justificatifFournit
                                );
                                return { adherent: a, currentStatut, currentJustificatif };
                              })
                              .sort((x, y) => {
                                if (participantsSort.key === "adherent") {
                                  const aName = `${x.adherent.firstname ?? ""} ${x.adherent.lastname ?? ""}`
                                    .trim()
                                    .toLowerCase();
                                  const bName = `${y.adherent.firstname ?? ""} ${y.adherent.lastname ?? ""}`
                                    .trim()
                                    .toLowerCase();
                                  const cmp = aName.localeCompare(bName, "fr");
                                  return participantsSort.direction === "asc" ? cmp : -cmp;
                                }
                                const statusOrder: Record<StatutParticipationReunion, number> = {
                                  Present: 1,
                                  Excuse: 2,
                                  Absent: 3,
                                  NonRepondu: 4,
                                };
                                const cmp = statusOrder[x.currentStatut] - statusOrder[y.currentStatut];
                                return participantsSort.direction === "asc" ? cmp : -cmp;
                              })
                              .map(({ adherent: a, currentStatut, currentJustificatif }) => {
                                const statutBadgeClass =
                                  currentStatut === "Present"
                                    ? "border-green-300 bg-green-50 text-green-900"
                                    : currentStatut === "Absent"
                                      ? "border-red-300 bg-red-50 text-red-900"
                                      : currentStatut === "Excuse"
                                        ? "border-amber-300 bg-amber-50 text-amber-950"
                                        : "border-slate-300 bg-slate-50 text-slate-800";
                                return (
                                  <tr
                                    key={a.id}
                                    className="border-b border-slate-100 dark:border-slate-800"
                                  >
                                    <td className="px-3 py-2 align-top">
                                      <div className="font-medium text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-1.5">
                                        <span>
                                          {a.firstname} {a.lastname}
                                        </span>
                                        {a.userStatus === "Inactif" && (
                                          <span className="inline-flex rounded-md border border-slate-400 bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100">
                                            Inactif
                                          </span>
                                        )}
                                      </div>
                                      <div className="mt-1">
                                        <span
                                          className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statutBadgeClass}`}
                                        >
                                          {currentStatut === "Present"
                                            ? "Présent"
                                            : currentStatut === "Absent"
                                              ? "Absent"
                                              : currentStatut === "Excuse"
                                                ? "Excusé"
                                                : "Non répondu"}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <div className="space-y-2">
                                        <Select
                                          value={currentStatut}
                                          onValueChange={(v) =>
                                            setParticipantsEdits((prev) => ({
                                              ...prev,
                                              [a.id]: {
                                                statut: v as StatutParticipationReunion,
                                                justificatifFournit:
                                                  prev[a.id]?.justificatifFournit ?? false,
                                              },
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-8">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Present">Présent</SelectItem>
                                            <SelectItem value="Absent">Absent</SelectItem>
                                            <SelectItem value="Excuse">Excusé</SelectItem>
                                            <SelectItem value="NonRepondu">Non répondu</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        {(currentStatut === "Absent" ||
                                          currentStatut === "Excuse") && (
                                          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                            <Checkbox
                                              checked={currentJustificatif}
                                              onCheckedChange={(checked) =>
                                                setParticipantsEdits((prev) => ({
                                                  ...prev,
                                                  [a.id]: {
                                                    statut: prev[a.id]?.statut ?? currentStatut,
                                                    justificatifFournit: checked === true,
                                                  },
                                                }))
                                              }
                                            />
                                            Justificatif fourni
                                          </label>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <DialogFooter className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                      <Button
                        type="button"
                        onClick={handleSaveParticipants}
                        disabled={
                          loading ||
                          participantsDialogLoading ||
                          participantsRefreshing ||
                          !participantsDialogReady
                        }
                      >
                        Enregistrer
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeParticipantsDialog}
                      >
                        Fermer
                      </Button>
                    </DialogFooter>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={refreshConfirmScope !== null}
            onOpenChange={(open) => {
              if (!open) setRefreshConfirmScope(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Abandonner les modifications ?</AlertDialogTitle>
                <AlertDialogDescription>
                  {PARTICIPANTS_REFRESH_DISCARD_MESSAGE}
                  {refreshConfirmScope === "list" &&
                    (editingReunion || showForm) &&
                    " Les formulaires d'édition ou de création ouverts seront également fermés."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={confirmPendingRefresh}>
                  Actualiser
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Recherche d'adhérent (création) — panneau hors dialog création si besoin */}
          <InlineAdherentSearchPanel
            open={adherentSearchOpen}
            onOpenChange={setAdherentSearchOpen}
            onSelect={(adherent) => {
              setSelectedAdherent(adherent);
              setFormData({ ...formData, adherentHoteId: adherent.id });
            }}
            title="Sélectionner l'adhérent hôte"
            description="Choisissez l'adhérent qui accueillera la réunion"
          />
        </CardContent>
      </Card>
    </div>
  );
}
