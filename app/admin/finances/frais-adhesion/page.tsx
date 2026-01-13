"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
  createColumnHelper,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import {
  Euro,
  Settings,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  Edit,
  UserCheck,
  FileText,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  getConfigurationFraisAdhesion,
  updateConfigurationFraisAdhesion,
  getAdherentsFraisAdhesion,
  marquerAncienAdherent,
  creerObligationFraisAdhesion,
  marquerFraisAdhesionPaye,
} from "@/actions/finances/frais-adhesion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type AdherentFraisAdhesion = {
  id: string;
  firstname: string;
  lastname: string;
  email: string | null;
  status: string;
  typeAdhesion: string | null;
  datePremiereAdhesion: Date | null;
  fraisAdhesionPaye: boolean;
  datePaiementFraisAdhesion: Date | null;
  estAncienAdherent: boolean;
  obligationAdhesion: {
    id: string;
    montantAttendu: number;
    montantPaye: number;
    montantRestant: number;
    statut: string;
    dateEcheance: Date;
  } | null;
};

const columnHelper = createColumnHelper<AdherentFraisAdhesion>();

export default function FraisAdhesionPage() {
  const [config, setConfig] = useState<{ montantFraisAdhesion: number; description: string | null } | null>(null);
  const [adherents, setAdherents] = useState<AdherentFraisAdhesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [columnVisibility, setColumnVisibility] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-frais-adhesion-column-visibility");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Object.keys(parsed).length > 0) {
            return parsed;
          }
        }
        // Par défaut sur mobile, masquer les colonnes non essentielles
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          return {
            email: false,
            datePremiereAdhesion: false,
            datePaiement: false,
            montantPaye: false,
            statut: false,
            // Garder visible : firstname/lastname (nom complet), montantAttendu, actions (si présente)
          };
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });

  // Détecter les changements de taille d'écran
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const saved = localStorage.getItem("admin-frais-adhesion-column-visibility");
      
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          email: false,
          datePremiereAdhesion: false,
          datePaiement: false,
          montantPaye: false,
          statut: false,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // États pour les dialogs
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showMarquerAncienDialog, setShowMarquerAncienDialog] = useState(false);
  const [showMarquerPayeDialog, setShowMarquerPayeDialog] = useState(false);
  const [selectedAdherent, setSelectedAdherent] = useState<AdherentFraisAdhesion | null>(null);
  const [montantConfig, setMontantConfig] = useState("");
  const [descriptionConfig, setDescriptionConfig] = useState("");
  const [datePremiereAdhesion, setDatePremiereAdhesion] = useState("");
  const [datePaiement, setDatePaiement] = useState("");
  const [montantPaye, setMontantPaye] = useState("");

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [configResult, adherentsResult] = await Promise.all([
        getConfigurationFraisAdhesion(),
        getAdherentsFraisAdhesion(),
      ]);

      if (configResult.success && configResult.data) {
        setConfig(configResult.data);
        setMontantConfig(configResult.data.montantFraisAdhesion.toFixed(2));
        setDescriptionConfig(configResult.data.description || "");
      } else if (!configResult.data) {
        // Si aucune configuration n'existe, créer une par défaut à 50€
        const defaultConfig = await updateConfigurationFraisAdhesion({
          montant: 50.0,
          description: "Frais d'adhésion par défaut",
        });
        if (defaultConfig.success && defaultConfig.data) {
          setConfig(defaultConfig.data);
          setMontantConfig("50.00");
          setDescriptionConfig("Frais d'adhésion par défaut");
        }
      }

      if (adherentsResult.success && adherentsResult.data) {
        setAdherents(adherentsResult.data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrer les données
  const filteredData = useMemo(() => {
    return adherents.filter((item) => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.firstname || "",
          item.lastname || "",
          item.email || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      // Filtre par statut (payé/non payé)
      if (statutFilter !== "all") {
        if (statutFilter === "paye" && !item.fraisAdhesionPaye) return false;
        if (statutFilter === "non-paye" && item.fraisAdhesionPaye) return false;
      }

      // Filtre par type (ancien/nouveau)
      if (typeFilter !== "all") {
        if (typeFilter === "ancien" && !item.estAncienAdherent) return false;
        if (typeFilter === "nouveau" && item.estAncienAdherent) return false;
      }

      return true;
    });
  }, [adherents, globalFilter, statutFilter, typeFilter]);

  // Statistiques
  const stats = useMemo(() => {
    const total = adherents.length;
    const anciens = adherents.filter((a) => a.estAncienAdherent).length;
    const nouveaux = total - anciens;
    const payes = adherents.filter((a) => a.fraisAdhesionPaye).length;
    const nonPayes = total - payes;
    const totalAttendu = adherents.reduce((sum, a) => {
      if (a.obligationAdhesion) {
        return sum + a.obligationAdhesion.montantRestant;
      }
      return sum;
    }, 0);
    const totalPaye = adherents.reduce((sum, a) => {
      if (a.obligationAdhesion) {
        return sum + a.obligationAdhesion.montantPaye;
      }
      return sum;
    }, 0);

    return {
      total,
      anciens,
      nouveaux,
      payes,
      nonPayes,
      totalAttendu,
      totalPaye,
    };
  }, [adherents]);

  const columns = useMemo<ColumnDef<AdherentFraisAdhesion>[]>(
    () => [
      columnHelper.accessor("lastname", {
        header: "Nom",
        cell: ({ row }) => (
          <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">
            {row.original.lastname}
          </span>
        ),
        size: 150,
      }),
      columnHelper.accessor("firstname", {
        header: "Prénom",
        cell: ({ row }) => (
          <span className="text-sm text-gray-900 dark:text-gray-100">
            {row.original.firstname}
          </span>
        ),
        size: 150,
      }),
      columnHelper.accessor("email", {
        header: "Email",
        cell: ({ row }) => (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {row.original.email || "—"}
          </span>
        ),
        size: 200,
      }),
      columnHelper.accessor("estAncienAdherent", {
        header: "Type",
        cell: ({ row }) => (
          <Badge
            variant={row.original.estAncienAdherent ? "default" : "outline"}
            className={
              row.original.estAncienAdherent
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            }
          >
            {row.original.estAncienAdherent ? "Ancien" : "Nouveau"}
          </Badge>
        ),
        size: 100,
      }),
      columnHelper.accessor("fraisAdhesionPaye", {
        header: "Statut",
        cell: ({ row }) => (
          <Badge
            variant={row.original.fraisAdhesionPaye ? "default" : "outline"}
            className={
              row.original.fraisAdhesionPaye
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }
          >
            {row.original.fraisAdhesionPaye ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Payé
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Non payé
              </>
            )}
          </Badge>
        ),
        size: 120,
      }),
      columnHelper.accessor("obligationAdhesion", {
        header: "Montant",
        cell: ({ row }) => {
          const obligation = row.original.obligationAdhesion;
          if (!obligation) {
            return <span className="text-xs text-gray-500">—</span>;
          }
          return (
            <div className="text-xs">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {obligation.montantRestant.toFixed(2)} €
              </div>
              {obligation.montantPaye > 0 && (
                <div className="text-gray-500">
                  Payé: {obligation.montantPaye.toFixed(2)} €
                </div>
              )}
            </div>
          );
        },
        size: 120,
      }),
      columnHelper.accessor("datePaiementFraisAdhesion", {
        header: "Date paiement",
        cell: ({ row }) => {
          const date = row.original.datePaiementFraisAdhesion;
          if (!date) return <span className="text-xs text-gray-500">—</span>;
          return (
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {format(new Date(date), "dd/MM/yyyy", { locale: fr })}
            </span>
          );
        },
        size: 120,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        meta: { forceVisible: true },
        enableResizing: false,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-1 sm:gap-2">
              {!item.fraisAdhesionPaye && !item.estAncienAdherent && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900"
                  onClick={() => {
                    setSelectedAdherent(item);
                    setDatePremiereAdhesion(
                      item.datePremiereAdhesion
                        ? format(new Date(item.datePremiereAdhesion), "yyyy-MM-dd")
                        : ""
                    );
                    setShowMarquerAncienDialog(true);
                  }}
                  title="Marquer comme ancien adhérent"
                >
                  <UserCheck className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              )}
              {!item.obligationAdhesion && !item.fraisAdhesionPaye && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900"
                  onClick={async () => {
                    try {
                      const result = await creerObligationFraisAdhesion({
                        adherentId: item.id,
                      });
                      if (result.success) {
                        toast.success(result.message);
                        loadData();
                      } else {
                        toast.error(result.error || "Erreur");
                      }
                    } catch (error) {
                      toast.error("Erreur lors de la création de l'obligation");
                    }
                  }}
                  title="Créer une obligation"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              )}
              {item.obligationAdhesion && !item.fraisAdhesionPaye && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900"
                  onClick={() => {
                    setSelectedAdherent(item);
                    setDatePaiement(format(new Date(), "yyyy-MM-dd"));
                    setMontantPaye(
                      item.obligationAdhesion
                        ? item.obligationAdhesion.montantRestant.toFixed(2)
                        : config?.montantFraisAdhesion.toFixed(2) || "50.00"
                    );
                    setShowMarquerPayeDialog(true);
                  }}
                  title="Marquer comme payé"
                >
                  <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              )}
            </div>
          );
        },
        size: 150,
      }),
    ],
    [config, loadData]
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
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: (updater) => {
      const newVisibility =
        typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem(
          "admin-frais-adhesion-column-visibility",
          JSON.stringify(newVisibility)
        );
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
  });

  const handleUpdateConfig = async () => {
    try {
      const montant = parseFloat(montantConfig.replace(",", "."));
      if (isNaN(montant) || montant <= 0) {
        toast.error("Le montant doit être un nombre positif");
        return;
      }

      const result = await updateConfigurationFraisAdhesion({
        montant,
        description: descriptionConfig || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        setShowConfigDialog(false);
        loadData();
      } else {
        toast.error(result.error || "Erreur");
      }
    } catch (error) {
      toast.error("Erreur lors de la mise à jour de la configuration");
    }
  };

  const handleMarquerAncien = async () => {
    if (!selectedAdherent) return;

    try {
      const result = await marquerAncienAdherent({
        adherentId: selectedAdherent.id,
        datePremiereAdhesion: datePremiereAdhesion
          ? new Date(datePremiereAdhesion)
          : undefined,
      });

      if (result.success) {
        toast.success(result.message);
        setShowMarquerAncienDialog(false);
        setSelectedAdherent(null);
        setDatePremiereAdhesion("");
        loadData();
      } else {
        toast.error(result.error || "Erreur");
      }
    } catch (error) {
      toast.error("Erreur lors du marquage de l'ancien adhérent");
    }
  };

  const handleMarquerPaye = async () => {
    if (!selectedAdherent) return;

    try {
      const montant = parseFloat(montantPaye.replace(",", "."));
      if (isNaN(montant) || montant <= 0) {
        toast.error("Le montant doit être un nombre positif");
        return;
      }

      const result = await marquerFraisAdhesionPaye({
        adherentId: selectedAdherent.id,
        datePaiement: new Date(datePaiement),
        montant,
      });

      if (result.success) {
        toast.success(result.message);
        setShowMarquerPayeDialog(false);
        setSelectedAdherent(null);
        setDatePaiement("");
        setMontantPaye("");
        loadData();
      } else {
        toast.error(result.error || "Erreur");
      }
    } catch (error) {
      toast.error("Erreur lors du marquage des frais comme payés");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-4 sm:py-6 px-4 sm:px-6">
        <div className="space-y-4 sm:space-y-6">
          {/* Titre */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
              Gestion des Frais d'Adhésion
            </h1>
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="!py-0 border-blue-200 dark:border-blue-800">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white pb-2 pt-3 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Total Adhérents
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.total}
                </div>
              </CardContent>
            </Card>

            <Card className="!py-0 border-purple-200 dark:border-purple-800">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white pb-2 pt-3 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Anciens / Nouveaux
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                <div className="text-sm sm:text-base">
                  <div className="font-semibold text-purple-600 dark:text-purple-400">
                    {stats.anciens} / {stats.nouveaux}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="!py-0 border-green-200 dark:border-green-800">
              <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white pb-2 pt-3 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Payés / Non payés
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                <div className="text-sm sm:text-base">
                  <div className="font-semibold text-green-600 dark:text-green-400">
                    {stats.payes} / {stats.nonPayes}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="!py-0 border-orange-200 dark:border-orange-800">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white pb-2 pt-3 px-3 sm:px-4">
                <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  Montant Attendu
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                <div className="text-lg sm:text-xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.totalAttendu.toFixed(2)} €
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Configuration */}
          <Card className="!py-0 border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white pb-2 pt-3 px-3 sm:px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuration des Frais d'Adhésion
                </CardTitle>
                <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white/20 hover:bg-white/30 border-white/30 text-white"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Modifier la Configuration</DialogTitle>
                      <DialogDescription>
                        Modifier le montant des frais d'adhésion. Cette modification s'appliquera aux nouveaux adhérents.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="montant">Montant (€) *</Label>
                        <Input
                          id="montant"
                          type="number"
                          step="0.01"
                          value={montantConfig}
                          onChange={(e) => setMontantConfig(e.target.value)}
                          placeholder="50.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={descriptionConfig}
                          onChange={(e) => setDescriptionConfig(e.target.value)}
                          placeholder="Description des frais d'adhésion"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowConfigDialog(false)}
                        >
                          Annuler
                        </Button>
                        <Button onClick={handleUpdateConfig}>
                          Enregistrer
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Montant actuel
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {config?.montantFraisAdhesion.toFixed(2) || "50.00"} €
                  </div>
                </div>
                {config?.description && (
                  <div className="text-sm text-gray-500 dark:text-gray-500">
                    {config.description}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Liste des adhérents */}
          <Card className="!py-0 border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white pb-2 pt-3 px-3 sm:px-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Liste des Adhérents ({filteredData.length})
                </CardTitle>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <ColumnVisibilityToggle
                    table={table}
                    storageKey="admin-frais-adhesion-column-visibility"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              {/* Filtres */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11"
                  />
                </div>
                <Select value={statutFilter} onValueChange={setStatutFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="paye">Payés</SelectItem>
                    <SelectItem value="non-paye">Non payés</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filtrer par type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="ancien">Anciens</SelectItem>
                    <SelectItem value="nouveau">Nouveaux</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                    {filteredData.length} adhérent(s) trouvé(s)
                  </div>
                  <DataTable table={table} emptyMessage="Aucun adhérent trouvé" compact={true} />
                  
                  {/* Pagination */}
                  <div className="bg-white dark:bg-gray-800 mt-4 sm:mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0 py-3 sm:py-5 px-3 sm:px-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                    <div className="text-xs sm:text-sm text-muted-foreground dark:text-gray-400 w-full sm:w-auto text-center sm:text-left">
                      {table.getFilteredRowModel().rows.length} ligne(s) au total
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 lg:gap-8 w-full sm:w-auto">
                      <div className="flex items-center space-x-2 w-full sm:w-auto justify-center sm:justify-start">
                        <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Lignes par page</p>
                        <Select
                          value={`${table.getState().pagination.pageSize}`}
                          onValueChange={(value) => {
                            table.setPageSize(Number(value));
                          }}
                        >
                          <SelectTrigger className="h-8 w-[70px] text-xs sm:text-sm">
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

                      <div className="flex items-center justify-center text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
                      </div>
                      <div className="flex items-center space-x-1 sm:space-x-2">
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
                          className="h-8 w-8 p-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                          onClick={() => table.previousPage()}
                          disabled={!table.getCanPreviousPage()}
                        >
                          <span className="sr-only">Page précédente</span>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
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
        </div>
      </div>

      {/* Dialog Marquer Ancien */}
      <Dialog open={showMarquerAncienDialog} onOpenChange={setShowMarquerAncienDialog}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Marquer comme Ancien Adhérent</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Marquer {selectedAdherent?.firstname} {selectedAdherent?.lastname} comme ancien adhérent.
              Les frais d'adhésion seront considérés comme payés.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="datePremiereAdhesion" className="text-xs sm:text-sm">Date de première adhésion (optionnel)</Label>
              <Input
                id="datePremiereAdhesion"
                type="date"
                value={datePremiereAdhesion}
                onChange={(e) => setDatePremiereAdhesion(e.target.value)}
                className="mt-1 text-sm sm:text-base"
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMarquerAncienDialog(false);
                  setSelectedAdherent(null);
                  setDatePremiereAdhesion("");
                }}
                className="w-full sm:w-auto text-sm h-9 sm:h-10"
              >
                Annuler
              </Button>
              <Button onClick={handleMarquerAncien} className="w-full sm:w-auto text-sm h-9 sm:h-10">
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Marquer Payé */}
      <Dialog open={showMarquerPayeDialog} onOpenChange={setShowMarquerPayeDialog}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Marquer les Frais comme Payés</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Enregistrer le paiement des frais d'adhésion pour {selectedAdherent?.firstname}{" "}
              {selectedAdherent?.lastname}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="datePaiement" className="text-xs sm:text-sm">Date de paiement *</Label>
              <Input
                id="datePaiement"
                type="date"
                value={datePaiement}
                onChange={(e) => setDatePaiement(e.target.value)}
                required
                className="mt-1 text-sm sm:text-base"
              />
            </div>
            <div>
              <Label htmlFor="montantPaye" className="text-xs sm:text-sm">Montant payé (€) *</Label>
              <Input
                id="montantPaye"
                type="number"
                step="0.01"
                value={montantPaye}
                onChange={(e) => setMontantPaye(e.target.value)}
                placeholder="50.00"
                required
                className="mt-1 text-sm sm:text-base"
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMarquerPayeDialog(false);
                  setSelectedAdherent(null);
                  setDatePaiement("");
                  setMontantPaye("");
                }}
                className="w-full sm:w-auto text-sm h-9 sm:h-10"
              >
                Annuler
              </Button>
              <Button onClick={handleMarquerPaye} className="w-full sm:w-auto text-sm h-9 sm:h-10">
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

