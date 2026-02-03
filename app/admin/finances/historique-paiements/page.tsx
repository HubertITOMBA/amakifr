"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AdherentSearchDialog } from "@/components/admin/AdherentSearchDialog";
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
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getAllPaiements, createPaiement, getAdherentFinancialItems } from "@/actions/paiements";
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
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const MOIS_LABELS: Record<number, string> = {
  1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril", 5: "Mai", 6: "Juin",
  7: "Juillet", 8: "Août", 9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
};

export default function AdminHistoriquePaiementsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [moyenFilter, setMoyenFilter] = useState<string>("all");
  const [moisFilter, setMoisFilter] = useState<string>("all");
  const [anneeFilter, setAnneeFilter] = useState<string>("all");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPaiement, setSelectedPaiement] = useState<any | null>(null);
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
            description: true,
            montant: false,
            moyenPaiement: false,
            datePaiement: false,
            reference: false,
            objetPaye: false,
            actions: true,
          };
        }
        // Ordre par défaut : Adhérent, Description, Montant, Moyen, Date, Actions (masquer référence et objetPaye)
        return {
          reference: false,
          objetPaye: false,
        };
      } catch (e) {
        console.error(e);
      }
    }
    return { reference: false, objetPaye: false };
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
          item.reference || "",
          item.description || "",
          getMoyenPaiementLabel(item.moyenPaiement) || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchText.includes(q)) return false;
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
  }, [data, globalFilter, moyenFilter, moisFilter, anneeFilter]);

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

  const columns = useMemo(
    () => [
      // 1. Adhérent (ordre par défaut)
      columnHelper.accessor("Adherent", {
        header: "Adhérent",
        cell: ({ row }) => {
          const adherent = row.original.Adherent;
          const datePaiement = row.original.datePaiement;
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {adherent?.firstname} {adherent?.lastname}
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
      }),
      // 2. Description
      columnHelper.display({
        id: "description",
        header: "Description",
        cell: ({ row }) => {
          const p = row.original;
          const cm = p.CotisationMensuelle;
          const desc = (cm?.description ?? p.description) || "";
          const typeNom = cm?.TypeCotisation?.nom || "";
          let label = desc || typeNom || "—";
          if (label === "—") {
            if (cm?.mois != null && cm?.annee != null) {
              label = `Cotisation ${MOIS_LABELS[cm.mois] ?? cm.mois} ${cm.annee}`;
            } else if (p.DetteInitiale) {
              label = "Dette initiale";
            } else if (p.Assistance) {
              label = "Assistance";
            } else if (p.description) {
              label = p.description;
            }
          }
          return (
            <span className="text-sm text-gray-600 dark:text-gray-400" title={label}>
              {label}
            </span>
          );
        },
        size: 200,
        minSize: 150,
        maxSize: 400,
        enableResizing: true,
      }),
      // 3. Montant
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
            </div>
          );
        },
        size: 120,
        minSize: 90,
        maxSize: 150,
        enableResizing: true,
      }),
      // 4. Moyen de paiement
      columnHelper.accessor("moyenPaiement", {
        header: "Moyen de paiement",
        cell: ({ row }) => (
          <Badge className={getMoyenPaiementColor(row.getValue("moyenPaiement"))}>
            {getMoyenPaiementLabel(row.getValue("moyenPaiement"))}
          </Badge>
        ),
        size: 150,
        minSize: 120,
        maxSize: 200,
        enableResizing: true,
      }),
      // 5. Date
      columnHelper.accessor("datePaiement", {
        header: "Date",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {format(new Date(row.getValue("datePaiement")), "d MMM yyyy", { locale: fr })}
            </span>
          </div>
        ),
        size: 150,
        minSize: 120,
        maxSize: 200,
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
      columnHelper.display({
        id: "objetPaye",
        header: "Cotisation / Objet payé",
        cell: ({ row }) => {
          const p = row.original;
          const cm = p.CotisationMensuelle;
          const nomType = cm?.TypeCotisation?.nom;
          const mois = cm?.mois;
          const annee = cm?.annee;
          let label = "—";
          if (cm) {
            label = nomType
              ? `${nomType} ${mois != null && annee != null ? `${MOIS_LABELS[mois] ?? mois} ${annee}` : ""}`.trim()
              : mois != null && annee != null
                ? `Cotisation ${MOIS_LABELS[mois] ?? mois} ${annee}`
                : "Cotisation";
          } else if (p.DetteInitiale) {
            label = "Dette initiale";
          } else if (p.Assistance) {
            label = "Assistance";
          } else if (p.description) {
            label = p.description;
          }
          return (
            <span className="text-sm text-gray-700 dark:text-gray-300" title={label}>
              {label}
            </span>
          );
        },
        size: 220,
        minSize: 150,
        maxSize: 400,
        enableResizing: true,
      }),
      // 6. Actions
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
            onClick={() => {
              setSelectedPaiement(row.original);
              setDetailDialogOpen(true);
            }}
            aria-label="Voir les détails"
          >
            <Eye className="h-4 w-4" />
          </Button>
        ),
        size: 80,
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
            Adherent: true,
            description: true,
            montant: false,
            moyenPaiement: false,
            datePaiement: false,
            reference: false,
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

        <Card className="mx-auto max-w-screen-2xl w-full shadow-lg border-2 border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-gray-900 !py-0 flex-1 flex flex-col min-h-0">
          <CardHeader className="bg-gradient-to-r from-green-500/90 via-emerald-400/80 to-green-500/90 dark:from-green-700/50 dark:via-emerald-600/40 dark:to-green-700/50 text-white pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold text-white">
                <Receipt className="h-5 w-5 text-white" />
                Historique des paiements ({filteredData.length})
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
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
                        <AdherentSearchDialog
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
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par adhérent (nom, email)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-28"
                />
              </div>
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

        {/* Dialog Détails du paiement */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-600" />
                Détails du paiement
              </DialogTitle>
              <DialogDescription>
                Toutes les informations enregistrées pour ce paiement
              </DialogDescription>
            </DialogHeader>
            {selectedPaiement && (
              <div className="space-y-4 pt-2">
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Adhérent</Label>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {selectedPaiement.Adherent?.firstname} {selectedPaiement.Adherent?.lastname}
                  </p>
                  {selectedPaiement.Adherent?.User?.email && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">{selectedPaiement.Adherent.User.email}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Description / Objet</Label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedPaiement.CotisationMensuelle
                      ? selectedPaiement.CotisationMensuelle.TypeCotisation?.nom
                        ? `${selectedPaiement.CotisationMensuelle.TypeCotisation.nom} ${selectedPaiement.CotisationMensuelle.mois != null && selectedPaiement.CotisationMensuelle.annee != null ? `${MOIS_LABELS[selectedPaiement.CotisationMensuelle.mois] ?? selectedPaiement.CotisationMensuelle.mois} ${selectedPaiement.CotisationMensuelle.annee}` : ""}`.trim()
                        : `Cotisation ${selectedPaiement.CotisationMensuelle.mois != null && selectedPaiement.CotisationMensuelle.annee != null ? `${MOIS_LABELS[selectedPaiement.CotisationMensuelle.mois] ?? selectedPaiement.CotisationMensuelle.mois} ${selectedPaiement.CotisationMensuelle.annee}` : ""}`.trim()
                      : selectedPaiement.DetteInitiale
                        ? "Dette initiale"
                        : selectedPaiement.Assistance
                          ? "Assistance"
                          : selectedPaiement.description || "—"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Montant</Label>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                      {Number(selectedPaiement.montant).toFixed(2)} €
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Moyen de paiement</Label>
                    <p className="text-sm">
                      <Badge className={getMoyenPaiementColor(selectedPaiement.moyenPaiement)}>
                        {getMoyenPaiementLabel(selectedPaiement.moyenPaiement)}
                      </Badge>
                    </p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date de paiement</Label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedPaiement.datePaiement
                      ? format(new Date(selectedPaiement.datePaiement), "EEEE d MMMM yyyy", { locale: fr })
                      : "—"}
                  </p>
                </div>
                {selectedPaiement.reference && (
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Référence</Label>
                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300">{selectedPaiement.reference}</p>
                  </div>
                )}
                {selectedPaiement.description && (
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Description (texte)</Label>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedPaiement.description}</p>
                  </div>
                )}
                {selectedPaiement.CreatedBy && (
                  <div className="grid gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Enregistré par</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedPaiement.CreatedBy.name}
                      {selectedPaiement.CreatedBy.email && ` (${selectedPaiement.CreatedBy.email})`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
