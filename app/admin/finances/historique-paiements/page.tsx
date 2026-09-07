"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InlineAdherentSearchPanel } from "@/components/admin/InlineAdherentSearchPanel";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  Search,
  Plus,
  Calendar,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
  Eye,
  AlertTriangle,
  Euro,
  Hash,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getAllPaiements, createPaiement, getAdherentFinancialItems } from "@/actions/paiements";
import {
  adminValidatePaiement,
  adminRejectPaiement,
} from "@/actions/paiement-comptes";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  eventPaymentDestinationLabel,
  inscriptionParticipantKindLabel,
  matchesPaymentDomaineFilter,
  matchesPaymentPersonTypeFilter,
  normalizePersonTypeFilterForDomaine,
  resolveInscriptionParticipantKind,
  resolvePaymentDomaine,
  shouldShowPaymentPersonTypeFilter,
  type PaymentPersonTypeFilter,
} from "@/lib/services/evenements/admin-event-stats";
import {
  buildPaymentDestinationLabel,
  isTechnicalPaymentNote,
  adminHistoriqueColumnVisibilityForDomaine,
} from "@/lib/services/cotisations/payment-destination-label";

const columnHelper = createColumnHelper<any>();

const getMoyenPaiementLabel = (moyen: string) => {
  switch (moyen) {
    case "Especes":
      return "Espèces";
    case "Cheque":
      return "Chèque";
    case "Virement":
      return "Virement";
    case "CarteBancaire":
      return "Carte bancaire";
    case "Wero":
      return "Wero";
    default:
      return moyen;
  }
};

const getMoyenPaiementColor = (moyen: string) => {
  switch (moyen) {
    case "Especes":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Cheque":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Virement":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "CarteBancaire":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "Wero":
      return "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatutPaiementLabel = (statut: string) => {
  switch (statut) {
    case "EnAttente":
      return "En attente";
    case "Valide":
      return "Validé";
    case "Annule":
      return "Annulé";
    case "EnCours":
      return "En cours";
    default:
      return statut || "—";
  }
};

const getStatutPaiementColor = (statut: string) => {
  switch (statut) {
    case "EnAttente":
      return "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100";
    case "Valide":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100";
    case "Annule":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-100";
    case "EnCours":
      return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-100";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200";
  }
};

const MOIS_LABELS: Record<number, string> = {
  1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril", 5: "Mai", 6: "Juin",
  7: "Juillet", 8: "Août", 9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
};

const getInscriptionEvenementLabel = (p: {
  InscriptionEvenement?: { Evenement?: { titre?: string | null } | null } | null;
}) => {
  return eventPaymentDestinationLabel(
    p.InscriptionEvenement?.Evenement?.titre
  );
};

/** Destination métier admin (jamais les notes techniques description). */
const getPaymentDestinationLabel = (p: any): string =>
  buildPaymentDestinationLabel({
    CotisationMensuelle: p.CotisationMensuelle
      ? {
          mois: p.CotisationMensuelle.mois,
          annee: p.CotisationMensuelle.annee,
          description: p.CotisationMensuelle.description,
          TypeCotisation: {
            nom: p.CotisationMensuelle.TypeCotisation?.nom || "Cotisation",
            categorie: p.CotisationMensuelle.TypeCotisation?.categorie,
            aBeneficiaire: p.CotisationMensuelle.TypeCotisation?.aBeneficiaire,
          },
          AdherentBeneficiaire: p.CotisationMensuelle.AdherentBeneficiaire ?? null,
        }
      : null,
    DetteInitiale: p.DetteInitiale
      ? { annee: p.DetteInitiale.annee }
      : null,
    Assistance: p.Assistance
      ? {
          type: p.Assistance.type,
          description: p.Assistance.description,
        }
      : null,
    ObligationCotisation: p.ObligationCotisation
      ? { periode: p.ObligationCotisation.periode }
      : null,
    InscriptionEvenement: p.InscriptionEvenement ?? null,
    description: p.description ?? null,
    detteInitialeId: p.detteInitialeId,
    cotisationMensuelleId: p.cotisationMensuelleId,
    assistanceId: p.assistanceId,
    obligationCotisationId: p.obligationCotisationId,
    inscriptionEvenementId: p.inscriptionEvenementId,
  });

export default function AdminHistoriquePaiementsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "datePaiement", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [moyenFilter, setMoyenFilter] = useState<string>("all");
  const [moisFilter, setMoisFilter] = useState<string>("all");
  const [anneeFilter, setAnneeFilter] = useState<string>("all");
  const [domaineFilter, setDomaineFilter] = useState<
    "all" | "cotisations" | "evenements"
  >("all");
  const [typePersonneFilter, setTypePersonneFilter] =
    useState<PaymentPersonTypeFilter>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [evenementFilter, setEvenementFilter] = useState<string>("all");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPaiement, setSelectedPaiement] = useState<any | null>(null);
  const [detailActionLoading, setDetailActionLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-historique-paiements-column-visibility");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Object.keys(parsed).length > 0) return parsed;
        }
        const mobile = window.innerWidth < 768;
        if (mobile) {
          return {
            ...adminHistoriqueColumnVisibilityForDomaine("all"),
            personne: true,
            destination: true,
            montant: false,
            moyenPaiement: false,
            datePaiement: false,
            reference: false,
            statut: true,
            actions: true,
          };
        }
        // Domaine = Tous par défaut : Destination + Domaine, pas Événement vide
        return {
          ...adminHistoriqueColumnVisibilityForDomaine("all"),
          reference: false,
        };
      } catch (e) {
        console.error(e);
      }
    }
    return {
      ...adminHistoriqueColumnVisibilityForDomaine("all"),
      reference: false,
    };
  });

  useEffect(() => {
    const checkMobile = () => {
      const mobile = typeof window !== "undefined" && window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize: isMobile ? 999 : prev.pageSize === 999 ? 10 : prev.pageSize, pageIndex: 0 }));
  }, [isMobile]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      const saved = localStorage.getItem("admin-historique-paiements-column-visibility");
      if (mobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          description: true,
          montant: false,
          moyenPaiement: false,
          datePaiement: false,
          reference: false,
          statut: true,
          objetPaye: false,
          actions: true,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [adherentSearchOpen, setAdherentSearchOpen] = useState(false);
  const [selectedAdherent, setSelectedAdherent] = useState<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  } | null>(null);
  const [financialItems, setFinancialItems] = useState<{
    dettes: any[];
    cotisations: any[];
    assistances: any[];
  }>({ dettes: [], cotisations: [], assistances: [] });
  const [loadingItems, setLoadingItems] = useState(false);
  const [formData, setFormData] = useState({
    adherentId: "",
    montant: "",
    datePaiement: new Date().toISOString().split("T")[0],
    moyenPaiement: "Especes" as "Especes" | "Cheque" | "Virement" | "CarteBancaire",
    reference: "",
    description: "",
    cotisationMensuelleId: "",
    detteInitialeId: "",
    assistanceId: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => setGlobalFilter(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAllPaiements();
      if (res.success && res.data) setData(res.data);
      else toast.error(res.error || "Erreur lors du chargement des paiements");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadFinancialItems = useCallback(async (adherentId: string) => {
    try {
      setLoadingItems(true);
      const res = await getAdherentFinancialItems(adherentId);
      if (res.success && res.data) setFinancialItems(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (selectedAdherent?.id) {
      loadFinancialItems(selectedAdherent.id);
    } else {
      setFinancialItems({ dettes: [], cotisations: [], assistances: [] });
      setFormData((prev) => ({
        ...prev,
        detteInitialeId: "",
        cotisationMensuelleId: "",
        assistanceId: "",
      }));
    }
  }, [selectedAdherent?.id, loadFinancialItems]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.Adherent?.firstname || "",
          item.Adherent?.lastname || "",
          item.Adherent?.User?.email || "",
          item.InscriptionEvenement?.visiteurNom || "",
          item.InscriptionEvenement?.visiteurEmail || "",
          item.reference || "",
          item.description || "",
          item.InscriptionEvenement?.Evenement?.titre || "",
          getMoyenPaiementLabel(item.moyenPaiement) || "",
          getStatutPaiementLabel(item.statut || "Valide") || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      if (!matchesPaymentDomaineFilter(item, domaineFilter)) return false;
      if (
        !matchesPaymentPersonTypeFilter(
          item,
          typePersonneFilter,
          domaineFilter
        )
      ) {
        return false;
      }
      if (statutFilter !== "all" && (item.statut || "Valide") !== statutFilter) {
        return false;
      }
      if (evenementFilter !== "all") {
        const evtId = item.InscriptionEvenement?.Evenement?.id;
        if (evtId !== evenementFilter) return false;
      }
      if (moyenFilter !== "all" && item.moyenPaiement !== moyenFilter) return false;
      if (moisFilter !== "all" && item.datePaiement) {
        const d = new Date(item.datePaiement);
        if (d.getMonth() + 1 !== Number(moisFilter)) return false;
      }
      if (anneeFilter !== "all" && item.datePaiement) {
        const d = new Date(item.datePaiement);
        if (d.getFullYear() !== Number(anneeFilter)) return false;
      }
      return true;
    });
  }, [
    data,
    globalFilter,
    moyenFilter,
    moisFilter,
    anneeFilter,
    domaineFilter,
    typePersonneFilter,
    statutFilter,
    evenementFilter,
  ]);

  const evenementsOptions = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((item) => {
      const evt = item.InscriptionEvenement?.Evenement;
      if (evt?.id && evt?.titre) {
        map.set(evt.id, evt.titre);
      }
    });
    return Array.from(map.entries())
      .map(([id, titre]) => ({ id, titre }))
      .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  }, [data]);

  const stats = useMemo(() => {
    const total = filteredData.length;
    const montantTotal = filteredData.reduce((s, p) => s + (Number(p.montant) || 0), 0);
    const now = new Date();
    const ceMois = filteredData.filter((p) => {
      if (!p.datePaiement) return false;
      const d = new Date(p.datePaiement);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const montantCeMois = filteredData
      .filter((p) => {
        if (!p.datePaiement) return false;
        const d = new Date(p.datePaiement);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, p) => s + (Number(p.montant) || 0), 0);
    return { total, montantTotal, ceMois, montantCeMois };
  }, [filteredData]);

  const anneesOptions = useMemo(() => {
    const years = new Set<number>();
    data.forEach((item) => {
      if (item.datePaiement) years.add(new Date(item.datePaiement).getFullYear());
    });
    const current = new Date().getFullYear();
    for (let y = current + 2; y >= current - 15; y--) years.add(y);
    return Array.from(years).sort((a, b) => b - a);
  }, [data]);

  const handleCreate = async () => {
    if (!formData.adherentId || !formData.montant) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    try {
      const result = await createPaiement({
        adherentId: formData.adherentId,
        montant: parseFloat(formData.montant),
        datePaiement: formData.datePaiement,
        moyenPaiement: formData.moyenPaiement,
        reference: formData.reference || undefined,
        description: formData.description || undefined,
        cotisationMensuelleId: formData.cotisationMensuelleId || undefined,
        detteInitialeId: formData.detteInitialeId || undefined,
        assistanceId: formData.assistanceId || undefined,
      });
      if (result.success) {
        toast.success(result.message);
        setCreateDialogOpen(false);
        setFormData({
          adherentId: "",
          montant: "",
          datePaiement: new Date().toISOString().split("T")[0],
          moyenPaiement: "Especes",
          reference: "",
          description: "",
          cotisationMensuelleId: "",
          detteInitialeId: "",
          assistanceId: "",
        });
        setSelectedAdherent(null);
        setFinancialItems({ dettes: [], cotisations: [], assistances: [] });
        loadData();
      } else {
        toast.error(result.error || "Erreur lors de l'enregistrement");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  // Colonnes dynamiques selon Domaine (pas de colonne Événement vide en Cotisations)
  useEffect(() => {
    if (isMobile) return;
    setColumnVisibility((prev) => ({
      ...prev,
      ...adminHistoriqueColumnVisibilityForDomaine(domaineFilter),
    }));
  }, [domaineFilter, isMobile]);

  const columns = useMemo(
    () => [
      columnHelper.accessor(
        (row) => {
          if (row.InscriptionEvenement && !row.Adherent) {
            return row.InscriptionEvenement.visiteurNom || "Visiteur";
          }
          return `${row.Adherent?.firstname ?? ""} ${row.Adherent?.lastname ?? ""}`.trim();
        },
        {
          id: "personne",
          header: "Personne",
          cell: ({ row }) => {
            const p = row.original;
            const isEventVisitor =
              resolvePaymentDomaine(p) === "evenements" &&
              resolveInscriptionParticipantKind(
                p.InscriptionEvenement?.adherentId ?? p.Adherent?.id
              ) === "Visiteur";
            const name = isEventVisitor
              ? p.InscriptionEvenement?.visiteurNom || "Visiteur"
              : `${p.Adherent?.firstname ?? ""} ${p.Adherent?.lastname ?? ""}`.trim() ||
                "—";
            const datePaiement = p.datePaiement;
            return (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {name}
                  </span>
                </div>
                {datePaiement && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 md:hidden ml-6 font-normal">
                    {format(new Date(datePaiement), "d MMM yyyy", { locale: fr })}
                  </span>
                )}
              </div>
            );
          },
          size: 200,
          minSize: 120,
          maxSize: 300,
          enableResizing: true,
        }
      ),
      columnHelper.accessor(
        (row) =>
          resolvePaymentDomaine(row) === "evenements" ? "Événements" : "Cotisations",
        {
          id: "domaine",
          header: "Domaine",
          cell: ({ getValue }) => (
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {getValue()}
            </span>
          ),
          size: 110,
          minSize: 90,
          maxSize: 140,
        }
      ),
      columnHelper.display({
        id: "typePersonne",
        header: "Type",
        cell: ({ row }) => {
          const p = row.original;
          if (resolvePaymentDomaine(p) !== "evenements") {
            return <span className="text-xs text-slate-400">—</span>;
          }
          const kind = resolveInscriptionParticipantKind(
            p.InscriptionEvenement?.adherentId ??
              (p.Adherent?.id ? p.Adherent.id : null)
          );
          return (
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {inscriptionParticipantKindLabel(kind)}
            </span>
          );
        },
        size: 100,
        minSize: 80,
        maxSize: 120,
      }),
      columnHelper.accessor(
        (row) => row.InscriptionEvenement?.Evenement?.titre || "",
        {
          id: "evenement",
          header: "Événement",
          cell: ({ row }) => {
            const p = row.original;
            if (!p.InscriptionEvenement) {
              return <span className="text-xs text-slate-400">—</span>;
            }
            const label = getInscriptionEvenementLabel(p);
            return (
              <span
                className="text-sm text-gray-700 dark:text-gray-300"
                title={label}
              >
                {p.InscriptionEvenement.Evenement?.titre || "Événement"}
              </span>
            );
          },
          size: 180,
          minSize: 120,
          maxSize: 260,
        }
      ),
      columnHelper.accessor((row) => getPaymentDestinationLabel(row), {
        id: "destination",
        header: "Destination",
        cell: ({ row }) => {
          const label = getPaymentDestinationLabel(row.original);
          return (
            <span
              className="text-sm text-gray-700 dark:text-gray-300"
              title={label}
            >
              {label}
            </span>
          );
        },
        size: 220,
        minSize: 150,
        maxSize: 360,
        enableResizing: true,
      }),
      // Conservé pour compat localStorage / toggle — masqué (notes techniques)
      columnHelper.display({
        id: "description",
        header: "Note technique",
        cell: ({ row }) => {
          const raw = row.original.description?.trim();
          if (!raw || !isTechnicalPaymentNote(raw)) {
            return <span className="text-xs text-slate-400">—</span>;
          }
          return (
            <span className="text-xs text-slate-500 line-clamp-2" title={raw}>
              {raw}
            </span>
          );
        },
        size: 160,
        enableResizing: true,
      }),
      columnHelper.accessor("montant", {
        header: "Montant",
        cell: ({ row }) => {
          const montant = row.getValue("montant") as number;
          const moyenPaiement = row.original.moyenPaiement;
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                {montant.toFixed(2)} €
              </span>
              {moyenPaiement && (
                <span className="text-xs text-gray-500 dark:text-gray-400 md:hidden font-normal">
                  {getMoyenPaiementLabel(moyenPaiement)}
                </span>
              )}
              {row.original.statut && (
                <span className="text-xs text-gray-500 dark:text-gray-400 md:hidden font-normal">
                  {getStatutPaiementLabel(row.original.statut)}
                </span>
              )}
            </div>
          );
        },
        size: 120,
        minSize: 90,
        maxSize: 150,
        enableResizing: true,
      }),
      columnHelper.accessor("moyenPaiement", {
        header: "Moyen",
        cell: ({ row }) => (
          <Badge className={getMoyenPaiementColor(row.getValue("moyenPaiement"))}>
            {getMoyenPaiementLabel(row.getValue("moyenPaiement"))}
          </Badge>
        ),
        size: 130,
        minSize: 100,
        maxSize: 180,
        enableResizing: true,
      }),
      columnHelper.accessor("statut", {
        header: "Statut",
        cell: ({ row }) => {
          const statut = (row.getValue("statut") as string) || "Valide";
          return (
            <Badge
              variant="outline"
              className={getStatutPaiementColor(statut)}
            >
              {getStatutPaiementLabel(statut)}
            </Badge>
          );
        },
        size: 130,
        minSize: 110,
        maxSize: 180,
        enableResizing: true,
      }),
      columnHelper.accessor("reference", {
        header: "Référence",
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
            {row.getValue("reference") || "—"}
          </span>
        ),
        size: 150,
        minSize: 120,
        maxSize: 200,
        enableResizing: true,
      }),
      columnHelper.accessor("datePaiement", {
        header: "Date",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {format(new Date(row.getValue("datePaiement")), "d MMM yyyy HH:mm", {
                locale: fr,
              })}
            </span>
          </div>
        ),
        size: 170,
        minSize: 140,
        maxSize: 220,
        enableResizing: true,
      }),
      columnHelper.display({
        id: "objetPaye",
        header: "Objet (legacy)",
        cell: ({ row }) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {getPaymentDestinationLabel(row.original)}
          </span>
        ),
        size: 180,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        meta: { forceVisible: true },
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              onClick={() => {
                setSelectedPaiement(row.original);
                setDetailDialogOpen(true);
              }}
              aria-label="Voir les détails"
              title="Voir les détails"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        ),
        size: 80,
        minSize: 70,
        maxSize: 100,
        enableResizing: false,
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    // Ne pas passer onGlobalFilterChange/globalFilter : la recherche est gérée dans filteredData (useMemo)
    // pour inclure correctement Adherent.firstname, Adherent.lastname, Adherent.User.email.
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem(
          "admin-historique-paiements-column-visibility",
          JSON.stringify(newVisibility)
        );
      } catch (e) {
        console.error(e);
      }
    },
    initialState: { pagination: { pageSize: 10 } },
    state: {
      sorting,
      columnFilters,
      columnVisibility: isMobile
        ? {
            personne: true,
            domaine: domaineFilter === "all",
            typePersonne: domaineFilter === "evenements",
            evenement: domaineFilter === "evenements",
            destination: domaineFilter !== "evenements",
            description: false,
            montant: false,
            moyenPaiement: false,
            datePaiement: false,
            reference: false,
            statut: true,
            objetPaye: false,
            actions: true,
          }
        : columnVisibility,

      pagination,
    },
    onPaginationChange: setPagination,
    defaultColumn: { minSize: 50, maxSize: 800 },
  });

  return (
    <div className="min-h-[90vh] bg-gradient-to-br from-green-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="p-4 sm:p-6 min-h-[85vh] flex flex-col">
        <div className="mb-4">
          <Link href="/admin/finances">
            <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
        </div>

        {/* Statistiques */}
        <div className="mx-auto max-w-screen-2xl w-full mt-4 grid grid-cols-2 lg:grid-cols-4 gap-1">
          <Card className="overflow-hidden pt-0 gap-0 py-0">
            <CardContent className="p-1.5 flex items-center justify-between gap-1 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight">Paiements</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{stats.total}</p>
              </div>
              <Hash className="h-4 w-4 shrink-0 text-emerald-600" />
            </CardContent>
          </Card>
          <Card className="overflow-hidden pt-0 gap-0 py-0">
            <CardContent className="p-1.5 flex items-center justify-between gap-1 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight">Total (€)</p>
                <p className="text-sm font-bold text-emerald-600 leading-tight">{stats.montantTotal.toFixed(2).replace(".", ",")}</p>
              </div>
              <Euro className="h-4 w-4 shrink-0 text-emerald-600" />
            </CardContent>
          </Card>
          <Card className="overflow-hidden pt-0 gap-0 py-0">
            <CardContent className="p-1.5 flex items-center justify-between gap-1 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight">Ce mois</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{stats.ceMois}</p>
              </div>
              <Receipt className="h-4 w-4 shrink-0 text-emerald-600" />
            </CardContent>
          </Card>
          <Card className="overflow-hidden pt-0 gap-0 py-0">
            <CardContent className="p-1.5 flex items-center justify-between gap-1 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight">Montant mois</p>
                <p className="text-sm font-bold text-emerald-600 leading-tight">{stats.montantCeMois.toFixed(2).replace(".", ",")} €</p>
              </div>
              <Euro className="h-4 w-4 shrink-0 text-emerald-600" />
            </CardContent>
          </Card>
        </div>

        <Card className="mx-auto max-w-screen-2xl w-full mt-4 shadow-lg border-2 border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-gray-900 !py-0 flex-1 flex flex-col min-h-0">
          <CardHeader className="bg-gradient-to-r from-green-500/90 via-emerald-400/80 to-green-500/90 dark:from-green-700/50 dark:via-emerald-600/40 dark:to-green-700/50 text-white pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold text-white">
                <Receipt className="h-5 w-5 text-white" />
                Historique des paiements ({filteredData.length})
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadData()}
                  disabled={loading}
                  className="bg-white/95 text-green-700 border-white hover:bg-green-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Actualiser
                </Button>
                <ColumnVisibilityToggle
                  table={table}
                  storageKey="admin-historique-paiements-column-visibility"
                />
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-white text-green-600 hover:bg-green-50">
                      <Plus className="h-4 w-4 mr-2" />
                      Nouveau paiement
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Enregistrer un paiement</DialogTitle>
                      <DialogDescription>
                        Enregistrez un paiement partiel ou complet pour un adhérent
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="adherent">Adhérent *</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setAdherentSearchOpen(true)}
                            className="flex-1 justify-start"
                          >
                            <User className="h-4 w-4 mr-2" />
                            {selectedAdherent
                              ? `${selectedAdherent.firstname} ${selectedAdherent.lastname}`
                              : "Rechercher un adhérent"}
                          </Button>
                          {selectedAdherent && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAdherent(null);
                                setFormData({
                                  ...formData,
                                  adherentId: "",
                                  detteInitialeId: "",
                                  cotisationMensuelleId: "",
                                  assistanceId: "",
                                });
                                setFinancialItems({ dettes: [], cotisations: [], assistances: [] });
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {selectedAdherent && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {selectedAdherent.email}
                          </p>
                        )}
                        <InlineAdherentSearchPanel
                          open={adherentSearchOpen}
                          onOpenChange={setAdherentSearchOpen}
                          onSelect={(adherent) => {
                            setSelectedAdherent(adherent);
                            setFormData({
                              ...formData,
                              adherentId: adherent.id,
                              detteInitialeId: "",
                              cotisationMensuelleId: "",
                              assistanceId: "",
                            });
                          }}
                          title="Rechercher un adhérent"
                          description="Tapez le nom, prénom ou email de l'adhérent"
                        />
                      </div>

                      {selectedAdherent && (
                        <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border">
                          <Label className="text-sm font-semibold">Lier le paiement à (optionnel)</Label>
                          {loadingItems ? (
                            <div className="text-sm text-gray-500">Chargement...</div>
                          ) : (
                            <div className="space-y-3">
                              {financialItems.dettes.length > 0 && (
                                <div>
                                  <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    Dettes initiales
                                  </Label>
                                  <Select
                                    value={formData.detteInitialeId || "none"}
                                    onValueChange={(value) =>
                                      setFormData({
                                        ...formData,
                                        detteInitialeId: value === "none" ? "" : value,
                                        cotisationMensuelleId: "",
                                        assistanceId: "",
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-9 text-sm">
                                      <SelectValue placeholder="Sélectionner une dette" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Aucune</SelectItem>
                                      {financialItems.dettes.map((d) => (
                                        <SelectItem key={d.id} value={d.id}>
                                          {d.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              {financialItems.cotisations.length > 0 && (
                                <div>
                                  <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    Cotisations mensuelles
                                  </Label>
                                  <Select
                                    value={formData.cotisationMensuelleId || "none"}
                                    onValueChange={(value) =>
                                      setFormData({
                                        ...formData,
                                        cotisationMensuelleId: value === "none" ? "" : value,
                                        detteInitialeId: "",
                                        assistanceId: "",
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-9 text-sm">
                                      <SelectValue placeholder="Sélectionner une cotisation" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Aucune</SelectItem>
                                      {financialItems.cotisations.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                          {c.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              {financialItems.assistances.length > 0 && (
                                <div>
                                  <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    Assistances
                                  </Label>
                                  <Select
                                    value={formData.assistanceId || "none"}
                                    onValueChange={(value) =>
                                      setFormData({
                                        ...formData,
                                        assistanceId: value === "none" ? "" : value,
                                        detteInitialeId: "",
                                        cotisationMensuelleId: "",
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-9 text-sm">
                                      <SelectValue placeholder="Sélectionner une assistance" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Aucune</SelectItem>
                                      {financialItems.assistances.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>
                                          {a.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              {financialItems.dettes.length === 0 &&
                                financialItems.cotisations.length === 0 &&
                                financialItems.assistances.length === 0 && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Aucune dette, cotisation ou assistance en attente pour cet adhérent
                                  </p>
                                )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="montant">Montant (€) *</Label>
                          <Input
                            id="montant"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.montant}
                            onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="datePaiement">Date de paiement *</Label>
                          <Input
                            id="datePaiement"
                            type="date"
                            value={formData.datePaiement}
                            onChange={(e) =>
                              setFormData({ ...formData, datePaiement: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="moyenPaiement">Moyen de paiement *</Label>
                        <Select
                          value={formData.moyenPaiement}
                          onValueChange={(value: any) =>
                            setFormData({ ...formData, moyenPaiement: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Especes">Espèces</SelectItem>
                            <SelectItem value="Cheque">Chèque</SelectItem>
                            <SelectItem value="Virement">Virement</SelectItem>
                            <SelectItem value="CarteBancaire">Carte bancaire</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="reference">Référence</Label>
                        <Input
                          id="reference"
                          value={formData.reference}
                          onChange={(e) =>
                            setFormData({ ...formData, reference: e.target.value })
                          }
                          placeholder="N° de chèque, virement, etc."
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                          placeholder="Description optionnelle"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                          Annuler
                        </Button>
                        <Button onClick={handleCreate}>Enregistrer</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 px-4 sm:px-6 flex-1 flex flex-col min-h-0 overflow-auto">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6 flex-wrap">
              <div className="flex flex-1 items-center gap-2 min-w-[200px]">
                <Search
                  className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
                  aria-hidden
                />
                <Input
                  placeholder="Rechercher personne, événement, référence…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
              <Select
                value={domaineFilter}
                onValueChange={(v) => {
                  const next = v as "all" | "cotisations" | "evenements";
                  setDomaineFilter(next);
                  setTypePersonneFilter((prev) =>
                    normalizePersonTypeFilterForDomaine(next, prev)
                  );
                }}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Domaine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les domaines</SelectItem>
                  <SelectItem value="cotisations">Cotisations</SelectItem>
                  <SelectItem value="evenements">Événements</SelectItem>
                </SelectContent>
              </Select>
              {shouldShowPaymentPersonTypeFilter(domaineFilter) ? (
                <Select
                  value={typePersonneFilter}
                  onValueChange={(v) =>
                    setTypePersonneFilter(v as PaymentPersonTypeFilter)
                  }
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="adherents">Adhérents</SelectItem>
                    <SelectItem value="visiteurs">Visiteurs</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              <Select value={statutFilter} onValueChange={setStatutFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="EnAttente">En attente</SelectItem>
                  <SelectItem value="Valide">Validé</SelectItem>
                  <SelectItem value="Annule">Rejeté / Annulé</SelectItem>
                </SelectContent>
              </Select>
              <Select value={evenementFilter} onValueChange={setEvenementFilter}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Événement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les événements</SelectItem>
                  {evenementsOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.titre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={moisFilter} onValueChange={setMoisFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Mois" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les mois</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {MOIS_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={anneeFilter} onValueChange={setAnneeFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les années</SelectItem>
                  {anneesOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={moyenFilter} onValueChange={setMoyenFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrer par moyen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les moyens</SelectItem>
                  <SelectItem value="Especes">Espèces</SelectItem>
                  <SelectItem value="Cheque">Chèque</SelectItem>
                  <SelectItem value="Virement">Virement</SelectItem>
                  <SelectItem value="CarteBancaire">Carte bancaire</SelectItem>
                  <SelectItem value="Wero">Wero</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                  {filteredData.length} paiement(s) trouvé(s)
                </div>
                <DataTable
                  table={table}
                  emptyMessage="Aucun paiement trouvé"
                  compact={true}
                  headerColor="green"
                />
                <div className="hidden md:flex bg-white dark:bg-gray-800 mt-4 sm:mt-5 flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 py-4 sm:py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 px-4 sm:px-6">
                  <div className="flex-1 text-xs sm:text-sm text-muted-foreground dark:text-gray-400 text-center sm:text-left">
                    {table.getFilteredRowModel().rows.length} ligne(s) au total
                  </div>
                  <div className="flex items-center space-x-4 sm:space-x-6 lg:space-x-8 w-full sm:w-auto justify-center sm:justify-end">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Lignes par page
                      </p>
                      <Select
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue placeholder={table.getState().pagination.pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                          {[10, 20, 30, 40, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                              {pageSize}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <span className="sr-only">Aller à la première page</span>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        <span className="sr-only">Page précédente</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        <span className="sr-only">Page suivante</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="hidden h-8 w-8 p-0 lg:flex"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                      >
                        <span className="sr-only">Aller à la dernière page</span>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Informations importantes */}
        <Card className="mx-auto max-w-screen-2xl w-full mt-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-medium text-amber-800 dark:text-amber-200">
                  Informations importantes
                </h3>
                <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  <li>• Les paiements peuvent concerner les cotisations (mensuelles, dettes, assistances) ou les inscriptions à un événement.</li>
                  <li>• Filtrez par domaine « Événements » pour isoler les paiements d&apos;inscription (libellé « Événement — … »).</li>
                  <li>• Un paiement peut être partiel (plusieurs paiements pour une même cible) ou complet.</li>
                  <li>• <strong>Les cotisations</strong> (montant, échéance, statut) se consultent depuis Admin &gt; Cotisations du mois.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dialog Détails du paiement */}
        <Dialog
          open={detailDialogOpen}
          onOpenChange={(open) => {
            setDetailDialogOpen(open);
            if (!open) {
              setSelectedPaiement(null);
              setDetailActionLoading(false);
            }
          }}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-2 border-emerald-200 dark:border-emerald-800 shadow-xl">
            <DialogHeader className="rounded-t-lg -mx-6 -mt-6 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-700 dark:to-teal-800 border-b border-emerald-200 dark:border-emerald-800">
              <DialogTitle className="flex items-center gap-2 text-white">
                <Receipt className="h-5 w-5" />
                Détails du paiement
              </DialogTitle>
              <DialogDescription className="text-emerald-100 dark:text-emerald-200/90 text-sm mt-0.5">
                Toutes les informations enregistrées pour ce paiement
              </DialogDescription>
            </DialogHeader>
            {selectedPaiement ? (
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                    Statut
                  </Label>
                  <Badge
                    variant="outline"
                    className={getStatutPaiementColor(selectedPaiement.statut || "Valide")}
                  >
                    {getStatutPaiementLabel(selectedPaiement.statut || "Valide")}
                  </Badge>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1">
                  <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Personne
                  </Label>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {selectedPaiement.Adherent
                      ? `${selectedPaiement.Adherent.firstname} ${selectedPaiement.Adherent.lastname}`
                      : selectedPaiement.InscriptionEvenement?.visiteurNom ||
                        "—"}
                  </p>
                  {(selectedPaiement.Adherent?.User?.email ||
                    selectedPaiement.InscriptionEvenement?.visiteurEmail) && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {selectedPaiement.Adherent?.User?.email ||
                        selectedPaiement.InscriptionEvenement?.visiteurEmail}
                    </p>
                  )}
                  {selectedPaiement.InscriptionEvenement && (
                    <p className="text-xs text-slate-500">
                      Type :{" "}
                      {inscriptionParticipantKindLabel(
                        resolveInscriptionParticipantKind(
                          selectedPaiement.InscriptionEvenement.adherentId ??
                            selectedPaiement.Adherent?.id
                        )
                      )}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3 space-y-1">
                  <Label className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">
                    Destination
                  </Label>
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {getPaymentDestinationLabel(selectedPaiement)}
                  </p>
                </div>
                {selectedPaiement.description?.trim() ? (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-3 space-y-1">
                    <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Note / Historique
                    </Label>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {selectedPaiement.description}
                    </p>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 p-3 space-y-1">
                    <Label className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Euro className="h-3.5 w-3.5" />
                      Montant
                    </Label>
                    <p className="text-base font-semibold text-green-700 dark:text-green-300">
                      {Number(selectedPaiement.montant).toFixed(2)} €
                    </p>
                  </div>
                  <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30 p-3 space-y-1">
                    <Label className="text-xs font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wide">Moyen</Label>
                    <p className="text-sm">
                      <Badge className={getMoyenPaiementColor(selectedPaiement.moyenPaiement)}>
                        {getMoyenPaiementLabel(selectedPaiement.moyenPaiement)}
                      </Badge>
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-3 space-y-1">
                  <Label className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Date de paiement
                  </Label>
                  <p className="text-sm text-amber-900 dark:text-amber-100">
                    {selectedPaiement.datePaiement
                      ? format(new Date(selectedPaiement.datePaiement), "EEEE d MMMM yyyy", { locale: fr })
                      : "—"}
                  </p>
                </div>
                {selectedPaiement.reference && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1">
                    <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" />
                      Référence
                    </Label>
                    <p className="text-sm font-mono text-gray-800 dark:text-gray-200">{selectedPaiement.reference}</p>
                  </div>
                )}
                {selectedPaiement.justificatifChemin && (
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 space-y-1">
                    <Label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Justificatif (virement)</Label>
                    <a
                      href={`/api/admin/payments/${selectedPaiement.id}/justificatif`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-700 dark:text-emerald-300 underline hover:no-underline"
                    >
                      Voir le justificatif
                    </a>
                  </div>
                )}
                {selectedPaiement.description && (
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Description (texte)</Label>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedPaiement.description}</p>
                  </div>
                )}
                {selectedPaiement.CreatedBy && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1 pt-3">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Enregistré par</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedPaiement.CreatedBy.name}
                      {selectedPaiement.CreatedBy.email && ` (${selectedPaiement.CreatedBy.email})`}
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  {(selectedPaiement.statut === "EnAttente" ||
                    selectedPaiement.statut === "Annule") && (
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={detailActionLoading}
                      onClick={async () => {
                        try {
                          setDetailActionLoading(true);
                          const res = await adminValidatePaiement(selectedPaiement.id);
                          if (res.success) {
                            toast.success(res.message || "Validé");
                            setDetailDialogOpen(false);
                            setSelectedPaiement(null);
                            await loadData();
                          } else {
                            toast.error(res.error || "Erreur");
                          }
                        } finally {
                          setDetailActionLoading(false);
                        }
                      }}
                    >
                      {detailActionLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      {selectedPaiement.statut === "Annule"
                        ? "Valider (corriger le rejet)"
                        : "Valider le paiement"}
                    </Button>
                  )}
                  {(selectedPaiement.statut === "EnAttente" ||
                    selectedPaiement.statut === "Valide") && (
                    <Button
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      disabled={detailActionLoading}
                      onClick={async () => {
                        try {
                          setDetailActionLoading(true);
                          const res = await adminRejectPaiement(selectedPaiement.id);
                          if (res.success) {
                            toast.success(res.message || "Rejeté");
                            setDetailDialogOpen(false);
                            setSelectedPaiement(null);
                            await loadData();
                          } else {
                            toast.error(res.error || "Erreur");
                          }
                        } finally {
                          setDetailActionLoading(false);
                        }
                      }}
                    >
                      {detailActionLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      {selectedPaiement.statut === "Valide"
                        ? "Annuler le paiement (crédits)"
                        : "Rejeter"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="sm:ml-auto"
                    disabled={detailActionLoading}
                    onClick={() => {
                      setDetailDialogOpen(false);
                      setSelectedPaiement(null);
                    }}
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
