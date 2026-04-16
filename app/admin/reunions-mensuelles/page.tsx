"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
} from "@/actions/reunions-mensuelles";
import { getAdherentsMembres } from "@/actions/cotisations-du-mois";
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
  const [adherents, setAdherents] = useState<any[]>([]);
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
  const [participantsEdits, setParticipantsEdits] = useState<Record<string, { statut: StatutParticipationReunion; justificatifFournit: boolean }>>({});
  const [participantsInitial, setParticipantsInitial] = useState<Record<string, { statut: StatutParticipationReunion; justificatifFournit: boolean }>>({});
  const [participantsSort, setParticipantsSort] = useState<{ key: "adherent" | "statut"; direction: "asc" | "desc" }>({
    key: "adherent",
    direction: "asc",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [reunionsResult, adherentsResult] = await Promise.all([
        getAllReunionsMensuelles(),
        getAdherentsMembres(),
      ]);

      if (reunionsResult.success && reunionsResult.data) {
        setReunions(reunionsResult.data);
      } else {
        console.error("Erreur getAllReunionsMensuelles:", reunionsResult.error);
        toast.error(reunionsResult.error || "Erreur lors du chargement des réunions");
      }

      if (adherentsResult.success && adherentsResult.adherents) {
        setAdherents(adherentsResult.adherents);
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

  const isReunionPassee = (reunion: any) => {
    if (!reunion?.dateReunion) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(reunion.dateReunion);
    if (Number.isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d.getTime() < now.getTime();
  };

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
        header: "Rapport",
        cell: (info) => {
          const rapport = info.getValue();
          if (!rapport) return <span className="text-muted-foreground text-xs">—</span>;
          return (
            <a
              href={`/admin/rapports-reunion?view=${rapport.id}`}
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              Voir le rapport
            </a>
          );
        },
      }),
      columnHelper.accessor("Participations", {
        header: "Participants",
        cell: (info) => {
          const reunion = info.row.original;
          const participations = info.getValue() || [];
          const presents = participations.filter((p: any) => p.statut === "Present").length;
          const absents = participations.filter((p: any) => p.statut === "Absent").length;
          const excuses = participations.filter((p: any) => p.statut === "Excuse").length;
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
    []
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

  const openParticipantsDialog = (reunion: any) => {
    const initial: Record<string, { statut: StatutParticipationReunion; justificatifFournit: boolean }> = {};
    adherents.forEach((a) => {
      const part = reunion.Participations?.find((p: any) => p.adherentId === a.id);
      initial[a.id] = {
        statut: (part?.statut ?? "NonRepondu") as StatutParticipationReunion,
        justificatifFournit: Boolean(part?.justificatifFournit),
      };
    });
    setParticipantsInitial(initial);
    setParticipantsEdits(initial);
    setParticipantsSort({ key: "adherent", direction: "asc" });
    setParticipantsDialogReunion(reunion);
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
    if (!participantsDialogReunion) return;
    setLoading(true);
    try {
      // Envoyer uniquement les changements pour ne pas écraser l'historique non modifié
      const payloadParticipations = adherents
        .map((a) => ({
          adherentId: a.id,
          statut: (participantsEdits[a.id]?.statut ?? "NonRepondu") as StatutParticipationReunion,
          justificatifFournit: Boolean(participantsEdits[a.id]?.justificatifFournit),
          initialStatut: (participantsInitial[a.id]?.statut ?? "NonRepondu") as StatutParticipationReunion,
          initialJustificatif: Boolean(participantsInitial[a.id]?.justificatifFournit),
        }))
        .filter((p) => p.statut !== p.initialStatut || p.justificatifFournit !== p.initialJustificatif)
        .map(({ adherentId, statut, justificatifFournit }) => ({ adherentId, statut, justificatifFournit }));

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
        const presents = payloadParticipations.filter((p) => p.statut === "Present").length;
        const absents = payloadParticipations.filter((p) => p.statut === "Absent").length;
        const excuses = payloadParticipations.filter((p) => p.statut === "Excuse").length;
        const nonRepondus = payloadParticipations.filter((p) => p.statut === "NonRepondu").length;

        toast.success(
          `Participants enregistrés - Présents: ${presents} | Absents: ${absents} | Excusés: ${excuses} | Non répondus: ${nonRepondus}`
        );
        setParticipantsDialogReunion(null);
        await loadData();
      } else {
        toast.error(result.error || "Erreur lors de l'enregistrement des participants");
      }
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement des participants");
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800 p-2 sm:p-4">
      <div className="mx-auto max-w-[96rem] w-full mb-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        </Button>
      </div>
      <Card className="mx-auto max-w-[96rem] w-full shadow-lg border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-4 w-4" />
              Gestion des Réunions Mensuelles ({reunions.length})
            </CardTitle>
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par mois, année, hôte..."
                  value={globalFilter}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-10"
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
          <Dialog open={!!editingReunion} onOpenChange={(open) => !open && setEditingReunion(null)}>
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
                        onClick={() => setAdherentSearchEditOpen(true)}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Changer
                      </Button>
                    </div>
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
          <Dialog open={!!participantsDialogReunion} onOpenChange={(open) => !open && setParticipantsDialogReunion(null)}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 border-2 border-blue-200 dark:border-blue-800">
              <DialogHeader className="rounded-t-lg px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white border-b border-blue-400/30">
                <DialogTitle className="text-base">Liste des participants</DialogTitle>
                <DialogDescription className="text-blue-100 text-xs mt-0.5">
                  {participantsDialogReunion && (
                    <>Réunion {moisOptions.find((m) => m.value === participantsDialogReunion.mois)?.label} {participantsDialogReunion.annee}</>
                  )}
                </DialogDescription>
              </DialogHeader>
              {participantsDialogReunion && (
                <div className="overflow-auto flex-1 min-h-0">
                  {(() => {
                    const stats = adherents.reduce(
                      (acc, a) => {
                        const part = participantsDialogReunion.Participations?.find((p: any) => p.adherentId === a.id);
                        const fallbackStatut = (part?.statut ?? "NonRepondu") as StatutParticipationReunion;
                        const statut = (participantsEdits[a.id]?.statut ?? fallbackStatut) as StatutParticipationReunion;
                        if (statut === "Present") acc.presents += 1;
                        else if (statut === "Absent") acc.absents += 1;
                        else if (statut === "Excuse") acc.excuses += 1;
                        else acc.nonRepondus += 1;
                        return acc;
                      },
                      { presents: 0, absents: 0, excuses: 0, nonRepondus: 0 }
                    );

                    return (
                      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100">
                            Présents: {stats.presents}
                          </Badge>
                          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-100">
                            Absents: {stats.absents}
                          </Badge>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-100">
                            Excusés: {stats.excuses}
                          </Badge>
                          <Badge variant="secondary" className="bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                            Non répondus: {stats.nonRepondus}
                          </Badge>
                        </div>
                      </div>
                    );
                  })()}
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <th className="text-left px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                          <button
                            type="button"
                            onClick={() => toggleParticipantsSort("adherent")}
                            className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            Adhérent
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </th>
                        <th className="text-left px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
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
                      {adherents
                        .map((a) => {
                          const part = participantsDialogReunion.Participations?.find((p: any) => p.adherentId === a.id);
                          const statut = (part?.statut ?? "NonRepondu") as StatutParticipationReunion;
                          const currentStatut = (participantsEdits[a.id]?.statut ?? statut) as StatutParticipationReunion;
                          const currentJustificatif = participantsEdits[a.id]?.justificatifFournit ?? Boolean(part?.justificatifFournit);
                          return { adherent: a, currentStatut, currentJustificatif };
                        })
                        .sort((x, y) => {
                          if (participantsSort.key === "adherent") {
                            const aName = `${x.adherent.firstname ?? ""} ${x.adherent.lastname ?? ""}`.trim().toLowerCase();
                            const bName = `${y.adherent.firstname ?? ""} ${y.adherent.lastname ?? ""}`.trim().toLowerCase();
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
                        return (
                          <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2">{a.firstname} {a.lastname}</td>
                            <td className="px-3 py-2">
                              <div className="space-y-2">
                                <Select
                                  value={currentStatut}
                                  onValueChange={(v) =>
                                    setParticipantsEdits((prev) => ({
                                      ...prev,
                                      [a.id]: {
                                        statut: v as StatutParticipationReunion,
                                        justificatifFournit: prev[a.id]?.justificatifFournit ?? false,
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
                                {(currentStatut === "Absent" || currentStatut === "Excuse") && (
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
                </div>
              )}
              <DialogFooter className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                <Button type="button" onClick={handleSaveParticipants} disabled={loading}>
                  Enregistrer
                </Button>
                <Button type="button" variant="outline" onClick={() => setParticipantsDialogReunion(null)}>
                  Fermer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Recherche d'adhérent inline (évite Dialog imbriqué) */}
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
        </CardContent>
      </Card>
    </div>
  );
}
