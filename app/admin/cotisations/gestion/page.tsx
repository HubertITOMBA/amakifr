"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  User,
  Euro, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter,
  Download,
  Eye,
  Edit,
  CreditCard,
  Mail,
  Phone,
  Calendar,
  Info,
  Settings,
  Send,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  X,
  MoreHorizontal
} from "lucide-react";
import { toast } from "sonner";
import { getAdherentsWithCotisations, createManualCotisation, updateCotisation } from "@/actions/cotisations";
import { isAuthorizationError } from "@/lib/utils";
import { createPaiementGeneral } from "@/actions/paiements";
import { sendRappelManuelCotisations, type TypeRappelMail } from "@/actions/notifications/rappel";
import { getLettreRelancePDF } from "@/actions/notifications/lettre-relance-pdf";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdherentWithCotisations {
  id: string;
  firstname: string;
  lastname: string;
  email?: string;
  civility?: string;
  User: {
    id: string;
    email: string;
    status: string;
    lastLogin: Date | null;
  };
  ObligationsCotisation: any[];
  Cotisations: any[];
  _count: {
    ObligationsCotisation: number;
    Cotisations: number;
  };
  totalDette: number;
  moisDeRetard: number;
  enRetard: boolean;
  montantForfait: number;
  montantOccasionnel: number;
  forfaitMoisCourant: number;
  assistanceMoisCourant: number;
  periodeMoisCourant?: string; // Format "YYYY-MM" (ex: "2025-01")
  montantAPayerPourAnnulerDette: number;
  totalAvoirs: number;
}

// Formater la période "YYYY-MM" en "Jan 2025"
function formatPeriode(periode: string): string {
  try {
    const [year, month] = periode.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return `${monthNames[monthIndex]} ${year}`;
  } catch {
    return periode;
  }
}

// Obtenir le mois courant formaté (ex: "Jan 2025")
function getCurrentMonthFormatted(): string {
  const now = new Date();
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
}

export default function AdminCotisationManagement() {
  const [adherents, setAdherents] = useState<AdherentWithCotisations[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedAdherent, setSelectedAdherent] = useState<AdherentWithCotisations | null>(null);
  const [selectedAdherentIds, setSelectedAdherentIds] = useState<Set<string>>(new Set());
  const [sendingRappels, setSendingRappels] = useState(false);
  const [rappelType, setRappelType] = useState<TypeRappelMail>("simple");
  const [generatingLettrePDF, setGeneratingLettrePDF] = useState(false);
  
  // Visibilité des colonnes - charger depuis localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-cotisations-column-visibility");
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
            civility: false,
            status: false,
            totalDette: false,
            moisDeRetard: false,
            forfaitMoisCourant: false,
            assistanceMoisCourant: false,
            totalAvoirs: false,
            // Garder visible : name, montantAPayerPourAnnulerDette, actions
          };
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences de colonnes:", error);
      }
    }
    return {};
  });

  // Détecter les changements de taille d'écran
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const saved = localStorage.getItem("admin-cotisations-column-visibility");
      
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setColumnVisibility({
          civility: false,
          status: false,
          totalDette: false,
          moisDeRetard: false,
          forfaitMoisCourant: false,
          assistanceMoisCourant: false,
          totalAvoirs: false,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaiementDialog, setShowPaiementDialog] = useState(false);
  const [adherentDetails, setAdherentDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [paiementAdherent, setPaiementAdherent] = useState<AdherentWithCotisations | null>(null);
  const [manualFormData, setManualFormData] = useState({
    type: "Forfait",
    montant: 15,
    moyenPaiement: "Especes",
    description: "",
    reference: "",
  });
  const [paiementFormData, setPaiementFormData] = useState({
    montant: "",
    datePaiement: new Date().toISOString().split('T')[0],
    moyenPaiement: "Especes" as "Especes" | "Cheque" | "Virement" | "CarteBancaire",
    reference: "",
    description: "",
  });

  useEffect(() => {
    loadAdherents();
  }, []);

  const loadAdherents = async () => {
    try {
      setLoading(true);
      const result = await getAdherentsWithCotisations();
      if (result.success && result.data) {
        const data = Array.isArray(result.data) ? result.data : [];
        setAdherents(data as unknown as AdherentWithCotisations[]);
      } else {
        setAdherents([]);
        // Ne pas afficher de toast pour les erreurs d'autorisation
        if (result.error && !isAuthorizationError(result.error)) {
          toast.error(result.error || "Erreur lors du chargement");
        }
      }
    } catch (error) {
      setAdherents([]);
      console.error("Erreur loadAdherents:", error);
      toast.error("Erreur lors du chargement des adhérents");
    } finally {
      setLoading(false);
    }
  };

  // Fonctions pour gérer la sélection
  const toggleSelectAdherent = (adherentId: string) => {
    setSelectedAdherentIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(adherentId)) {
        newSet.delete(adherentId);
      } else {
        newSet.add(adherentId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedAdherentIds.size === adherents.length) {
      setSelectedAdherentIds(new Set());
    } else {
      setSelectedAdherentIds(new Set(adherents.map((a) => a.id)));
    }
  };

  const handleSendRappels = async () => {
    if (selectedAdherentIds.size === 0) {
      toast.error("Veuillez sélectionner au moins un adhérent");
      return;
    }

    try {
      setSendingRappels(true);
      const result = await sendRappelManuelCotisations(Array.from(selectedAdherentIds), rappelType);
      
      if (result.success) {
        toast.success(result.message || `${result.data?.envoyes.length || 0} rappel(s) envoyé(s)`);
        if (result.data?.erreurs && result.data.erreurs.length > 0) {
          console.warn("Erreurs lors de l'envoi:", result.data.erreurs);
        }
        setSelectedAdherentIds(new Set()); // Réinitialiser la sélection
      } else {
        toast.error(result.error || "Erreur lors de l'envoi des rappels");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'envoi des rappels");
    } finally {
      setSendingRappels(false);
    }
  };

  const columns: ColumnDef<AdherentWithCotisations>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={selectedAdherentIds.size === adherents.length && adherents.length > 0}
            onCheckedChange={toggleSelectAll}
            aria-label="Sélectionner tout"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedAdherentIds.has(row.original.id)}
            onCheckedChange={() => toggleSelectAdherent(row.original.id)}
            aria-label={`Sélectionner ${row.original.firstname} ${row.original.lastname}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 50,
      },
      {
        accessorKey: "civility",
        header: "Civilité",
        cell: ({ row }) => {
          const adherent = row.original;
          return (
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {adherent.civility || "—"}
            </div>
          );
        },
      },
      {
        accessorKey: "name",
        header: "Nom complet",
        cell: ({ row }) => {
          const adherent = row.original;
          const status = adherent.User.status;
          const mois = adherent.moisDeRetard;
          return (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-300">
                  {adherent.firstname[0]}{adherent.lastname[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {adherent.firstname} {adherent.lastname}
                </p>
                {/* Afficher le statut et le retard en petit sur mobile */}
                <div className="text-xs text-gray-500 dark:text-gray-400 md:hidden flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge 
                    className={
                      status === "Actif" 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5 py-0" 
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-[10px] px-1.5 py-0"
                    }
                  >
                    {status}
                  </Badge>
                  {mois > 0 && (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-[10px] px-1.5 py-0">
                      {mois} mois retard
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Statut",
        cell: ({ row }) => {
          const adherent = row.original;
          const status = adherent.User.status;
          return (
            <Badge 
              className={
                status === "Actif" 
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              }
            >
              {status}
            </Badge>
          );
        },
      },
      {
        accessorKey: "totalDette",
        header: "Dette Totale",
        cell: ({ row }) => {
          const dette = row.getValue("totalDette") as number;
          return (
            <div className="text-right">
              <span className={`text-sm font-bold ${dette > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {dette.toFixed(2).replace('.', ',')} €
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "moisDeRetard",
        header: "Retard",
        cell: ({ row }) => {
          const mois = row.getValue("moisDeRetard") as number;
          return (
            <div className="text-center">
              {mois > 0 ? (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  {mois} mois
                </Badge>
              ) : (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  À jour
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "forfaitMoisCourant",
        header: () => (
          <div className="flex flex-col items-center gap-0.5">
            <span>Forfait</span>
            <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
              ({getCurrentMonthFormatted()})
            </span>
          </div>
        ),
        cell: ({ row }) => {
          const adherent = row.original;
          const montant = row.getValue("forfaitMoisCourant") as number;
          const periode = adherent.periodeMoisCourant;
          return (
            <div className="text-right">
              <div className="flex flex-col gap-0.5 items-end">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {montant.toFixed(2).replace('.', ',')} €
                </span>
                {periode ? (
                  <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                    {formatPeriode(periode)}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                    Non créé
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "assistanceMoisCourant",
        header: () => (
          <div className="flex flex-col items-center gap-0.5">
            <span>Assistance</span>
            <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">
              ({getCurrentMonthFormatted()})
            </span>
          </div>
        ),
        cell: ({ row }) => {
          const adherent = row.original;
          const montant = row.getValue("assistanceMoisCourant") as number;
          const periode = adherent.periodeMoisCourant;
          return (
            <div className="text-right">
              <div className="flex flex-col gap-0.5 items-end">
                <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  {montant.toFixed(2).replace('.', ',')} €
                </span>
                {periode ? (
                  <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded">
                    {formatPeriode(periode)}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                    Non créé
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "montantAPayerPourAnnulerDette",
        header: "A Payer",
        cell: ({ row }) => {
          const adherent = row.original;
          const montant = row.getValue("montantAPayerPourAnnulerDette") as number;
          const dette = adherent.totalDette;
          const avoirs = adherent.totalAvoirs;
          return (
            <div className="text-right">
              <div className="flex flex-col gap-0.5 items-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-end gap-1 cursor-help">
                      <span className={`text-sm font-bold ${montant > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {montant.toFixed(2).replace('.', ',')} €
                      </span>
                      {montant > 0 && (
                        <Info className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                      )}
                    </div>
                  </TooltipTrigger>
                  {montant > 0 && (
                    <TooltipContent>
                      <p>Pour annuler la dette</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                {/* Afficher la dette totale et les avoirs en petit sur mobile */}
                <div className="text-[10px] text-gray-500 dark:text-gray-400 md:hidden flex flex-col items-end gap-0.5">
                  {dette > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      Dette: {dette.toFixed(2).replace('.', ',')} €
                    </span>
                  )}
                  {avoirs > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      Avoirs: {avoirs.toFixed(2).replace('.', ',')} €
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "totalAvoirs",
        header: "Avoirs",
        cell: ({ row }) => {
          const avoirs = row.getValue("totalAvoirs") as number;
          return (
            <div className="text-right">
              {avoirs > 0 ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {avoirs.toFixed(2).replace('.', ',')} €
                </Badge>
              ) : (
                <span className="text-sm text-gray-400">0,00 €</span>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-center w-full">Actions</div>,
        meta: { forceVisible: true }, // Cette colonne ne peut pas être masquée
        cell: ({ row }) => {
          const adherent = row.original;
          return (
            <div className="flex items-center justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Ouvrir le menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setSelectedAdherent(adherent);
                      setShowManualForm(true);
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Saisir une cotisation</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      setLoadingDetails(true);
                      setShowViewModal(true);
                      try {
                        // Récupérer les détails complets de l'adhérent
                        const result = await getAdherentsWithCotisations();
                        if (result.success && result.data) {
                          const found = (result.data as unknown as AdherentWithCotisations[]).find(a => a.id === adherent.id);
                          if (found) {
                            setAdherentDetails(found);
                          }
                        }
                      } catch (error) {
                        toast.error("Erreur lors du chargement des détails");
                      } finally {
                        setLoadingDetails(false);
                      }
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Voir les détails</span>
                  </DropdownMenuItem>
                  {adherent.montantAPayerPourAnnulerDette > 0 && (
                    <DropdownMenuItem
                      onClick={() => {
                        setPaiementAdherent(adherent);
                        setPaiementFormData({
                          montant: "", // Laisser libre pour que l'admin puisse saisir le montant qu'il souhaite
                          datePaiement: new Date().toISOString().split('T')[0],
                          moyenPaiement: "Especes",
                          reference: "",
                          description: "",
                        });
                        setShowPaiementDialog(true);
                      }}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>Encaisser un paiement</span>
                    </DropdownMenuItem>
                  )}
                  {adherent.enRetard && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400"
                      >
                        <Mail className="h-4 w-4" />
                        <span>Relancer l'adhérent</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [selectedAdherentIds, adherents, toggleSelectAll, toggleSelectAdherent]
  );

  const table = useReactTable({
    data: adherents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem("admin-cotisations-column-visibility", JSON.stringify(newVisibility));
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = filterValue.toLowerCase().trim();
      if (!searchValue) return true;
      
      const adherent = row.original;
      const searchableText = [
        adherent.firstname || "",
        adherent.lastname || "",
        `${adherent.firstname} ${adherent.lastname}`,
        adherent.email || "",
        adherent.User?.email || "",
        adherent.totalDette?.toFixed(2) || "",
        adherent.civility || "",
      ].join(" ").toLowerCase();
      
      return searchableText.includes(searchValue);
    },
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
    },
  });

  const handleManualCotisation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdherent) return;

    try {
      const result = await createManualCotisation({
        adherentId: selectedAdherent.id,
        type: manualFormData.type as any,
        montant: manualFormData.montant,
        moyenPaiement: manualFormData.moyenPaiement as any,
        description: manualFormData.description,
        reference: manualFormData.reference,
      });

      if (result.success) {
        toast.success("Cotisation saisie avec succès");
        setShowManualForm(false);
        setSelectedAdherent(null);
        setManualFormData({
          type: "Forfait",
          montant: 15,
          moyenPaiement: "Especes",
          description: "",
          reference: "",
        });
        loadAdherents();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Erreur lors de la saisie de la cotisation");
    }
  };

  const totalDettes = (adherents ?? []).reduce((sum, adherent) => sum + (adherent?.totalDette ?? 0), 0);
  const adherentsEnRetard = (adherents ?? []).filter(adherent => adherent?.enRetard).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Chargement des adhérents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
              Gestion des Cotisations
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-1 sm:mt-2 text-sm sm:text-base lg:text-lg">
              Suivi des cotisations et gestion des adhérents
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Button
              onClick={() => window.location.href = '/admin/cotisations'}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Créer Cotisations
            </Button>
            <Button
              onClick={() => window.location.href = '/admin/types-cotisation'}
              variant="outline"
              className="w-full sm:w-auto border-purple-300 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-sm"
            >
              <Settings className="h-4 w-4 mr-2" />
              Types de Cotisation
            </Button>
          </div>
        </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="!py-0 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Total Adhérents
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1 sm:mt-2">
                  {adherents.length}
                </p>
              </div>
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Users className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="!py-0 border-red-200 dark:border-red-800 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-red-50/80 to-white dark:from-red-900/20 dark:to-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                  En Retard
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-red-900 dark:text-red-100 mt-1 sm:mt-2">
                  {adherentsEnRetard}
                </p>
              </div>
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="!py-0 border-orange-200 dark:border-orange-800 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-900/20 dark:to-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                  Total Dettes
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-900 dark:text-orange-100 mt-1 sm:mt-2">
                  {totalDettes.toFixed(2).replace('.', ',')} €
                </p>
              </div>
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <Euro className="h-6 w-6 sm:h-7 sm:w-7 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau */}
      <Card className="!py-0 shadow-xl border-blue-200 dark:border-blue-800">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 dark:from-blue-600/90 dark:to-blue-700/90 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                Liste des Adhérents
              </CardTitle>
              <CardDescription className="text-blue-100 dark:text-blue-200 mt-1 sm:mt-2 text-sm sm:text-base">
                Gestion des cotisations et suivi des dettes
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {selectedAdherentIds.size > 0 && (
                <>
                  <Select
                    value={rappelType}
                    onValueChange={(v) => setRappelType(v as TypeRappelMail)}
                    disabled={sendingRappels}
                  >
                    <SelectTrigger className="w-[180px] h-9 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                      <SelectValue placeholder="Type de rappel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Rappel simple</SelectItem>
                      <SelectItem value="detail">Rappel détaillé</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white border-0"
                    onClick={handleSendRappels}
                    disabled={sendingRappels}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendingRappels ? (
                      "Envoi..."
                    ) : (
                      `Envoyer rappel${selectedAdherentIds.size > 1 ? "s" : ""} (${selectedAdherentIds.size})`
                    )}
                  </Button>
                </>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    disabled={generatingLettrePDF}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {generatingLettrePDF ? "Génération..." : "Lettre de relance PDF"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Lettre de relance à imprimer</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {selectedAdherentIds.size === 1 && (
                    <DropdownMenuItem
                      onClick={async () => {
                        const id = Array.from(selectedAdherentIds)[0];
                        if (!id) return;
                        setGeneratingLettrePDF(true);
                        try {
                          const result = await getLettreRelancePDF(id);
                          if (result.success && result.pdfData && result.fileName) {
                            const a = document.createElement("a");
                            a.href = result.pdfData;
                            a.download = result.fileName;
                            a.click();
                            toast.success("Lettre de relance téléchargée");
                          } else {
                            toast.error(result.error || "Erreur lors de la génération");
                          }
                        } catch (e) {
                          toast.error("Erreur lors de la génération du PDF");
                        } finally {
                          setGeneratingLettrePDF(false);
                        }
                      }}
                    >
                      Lettre pré-remplie (adhérent sélectionné)
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={async () => {
                      setGeneratingLettrePDF(true);
                      try {
                        const result = await getLettreRelancePDF(null);
                        if (result.success && result.pdfData && result.fileName) {
                          const a = document.createElement("a");
                          a.href = result.pdfData;
                          a.download = result.fileName;
                          a.click();
                          toast.success("Modèle vierge téléchargé");
                        } else {
                          toast.error(result.error || "Erreur lors de la génération");
                        }
                      } catch (e) {
                        toast.error("Erreur lors de la génération du PDF");
                      } finally {
                        setGeneratingLettrePDF(false);
                      }
                    }}
                  >
                    Modèle vierge (à remplir à la main)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ColumnVisibilityToggle 
                table={table} 
                storageKey="admin-cotisations-column-visibility"
              />
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={async () => {
                  try {
                    toast.loading("Génération du PDF en cours...");
                    // Import dynamique de jsPDF et des helpers
                    const { default: jsPDF } = await import('jspdf');
                    const { addPDFHeader, addPDFFooter } = await import('@/lib/pdf-helpers-client');
                    const doc = new jsPDF();
                    
                    // Ajouter l'en-tête avec logo sur la première page uniquement
                    await addPDFHeader(doc, 'Rapport des Cotisations - Tous les Adhérents');
                    
                    let yPos = 60; // Commencer après l'en-tête
                    
                    // Date de génération
                    doc.setFontSize(12);
                    doc.setTextColor(100, 100, 100);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`Date de génération: ${new Date().toLocaleDateString('fr-FR')}`, 20, yPos);
                    yPos += 10;
                    
                    // En-têtes du tableau
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Adhérent', 20, yPos);
                    doc.text('Dette Totale', 100, yPos);
                    doc.text('Mois Retard', 140, yPos);
                    doc.text('Statut', 170, yPos);
                    yPos += 8;
                    
                    // Ligne de séparation
                    doc.setDrawColor(200, 200, 200);
                    doc.line(20, yPos, 190, yPos);
                    yPos += 5;
                    
                    // Données
                    doc.setFont('helvetica', 'normal');
                    adherents.forEach((adherent) => {
                      if (yPos > 250) { // Réduit pour laisser de la place au pied de page
                        doc.addPage();
                        yPos = 20; // Pas d'en-tête sur les pages suivantes
                      }
                      
                      doc.setFontSize(9);
                      doc.text(`${adherent.firstname} ${adherent.lastname}`.trim(), 20, yPos);
                      doc.text(`${adherent.totalDette.toFixed(2).replace('.', ',')} €`, 100, yPos);
                      doc.text(`${adherent.moisDeRetard}`, 140, yPos);
                      doc.setTextColor(adherent.enRetard ? 255 : 0, adherent.enRetard ? 0 : 200, 0);
                      doc.text(adherent.enRetard ? 'En retard' : 'À jour', 170, yPos);
                      doc.setTextColor(0, 0, 0);
                      yPos += 7;
                    });
                    
                    // Totaux
                    yPos += 5;
                    doc.setDrawColor(200, 200, 200);
                    doc.line(20, yPos, 190, yPos);
                    yPos += 5;
                    
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    doc.text(`Total adhérents: ${adherents.length}`, 20, yPos);
                    yPos += 6;
                    doc.text(`En retard: ${adherentsEnRetard}`, 20, yPos);
                    yPos += 6;
                    doc.text(`Total dettes: ${totalDettes.toFixed(2).replace('.', ',')} €`, 20, yPos);
                    
                    // Ajouter le pied de page sur toutes les pages
                    addPDFFooter(doc);
                    
                    // Télécharger le PDF
                    doc.save(`cotisations_rapport_${new Date().toISOString().split('T')[0]}.pdf`);
                    toast.dismiss();
                    toast.success("PDF exporté avec succès");
                  } catch (error) {
                    console.error("Erreur lors de l'export PDF:", error);
                    toast.dismiss();
                    toast.error("Erreur lors de l'export PDF");
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 pb-4 px-4 sm:px-6">
          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un adhérent..."
                value={globalFilter as string}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-28 border-gray-300 dark:border-gray-600"
              />
            </div>
            <Select
              value={(table.getColumn("status")?.getFilterValue() as string) ?? ""}
              onValueChange={(value) =>
                table.getColumn("status")?.setFilterValue(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-full sm:w-48 border-gray-300 dark:border-gray-600">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="Actif">Actif</SelectItem>
                <SelectItem value="Inactif">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="w-full min-w-0 md:min-w-[800px]">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b-2 border-gray-300 dark:border-gray-600 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700">
                    {headerGroup.headers.map((header, headerIndex) => {
                      const columnId = header.column.id;
                      const isVisible = header.column.getIsVisible();
                      // Masquer certaines colonnes sur mobile
                      const isMobileHidden = ['civility', 'status', 'totalDette', 'moisDeRetard', 'forfaitMoisCourant', 'assistanceMoisCourant', 'totalAvoirs'].includes(columnId);
                      
                      if (!isVisible) return null;
                      
                      return (
                        <th
                          key={header.id}
                          className={`px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 ${headerIndex === headerGroup.headers.length - 1 ? 'border-r-0' : ''} ${isMobileHidden ? 'hidden md:table-cell' : ''}`}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {table.getRowModel().rows.map((row, index) => (
                  <tr 
                    key={row.id} 
                    className={`
                      border-b border-gray-200 dark:border-gray-700
                      ${index % 2 === 0 
                        ? 'bg-white dark:bg-gray-900' 
                        : 'bg-gray-50/50 dark:bg-gray-800/30'
                      }
                      hover:bg-blue-50 dark:hover:bg-blue-900/30 
                      hover:border-l-4 hover:border-l-blue-500 dark:hover:border-l-blue-400
                      transition-all duration-150
                      cursor-pointer
                    `}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => {
                      const columnId = cell.column.id;
                      const isVisible = cell.column.getIsVisible();
                      // Masquer certaines colonnes sur mobile
                      const isMobileHidden = ['civility', 'status', 'totalDette', 'moisDeRetard', 'forfaitMoisCourant', 'assistanceMoisCourant', 'totalAvoirs'].includes(columnId);
                      
                      if (!isVisible) return null;
                      
                      const visibleCells = row.getVisibleCells().filter(c => c.column.getIsVisible());
                      const isLastCell = cellIndex === visibleCells.length - 1;
                      
                      return (
                        <td 
                          key={cell.id} 
                          className={`px-2 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700 ${isLastCell ? 'border-r-0' : ''} ${isMobileHidden ? 'hidden md:table-cell' : ''}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>

          {/* Pagination - Masquée sur mobile */}
          <div className="hidden md:flex bg-white dark:bg-gray-800 mt-5 flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4 sm:gap-0">
            <div className="ml-5 mt-2 flex-1 text-sm text-muted-foreground dark:text-gray-400">
              {table.getFilteredRowModel().rows.length} ligne(s) au total
            </div>

            <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lignes par page</p>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => {
                    table.setPageSize(Number(value));
                  }}
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
        </CardContent>
      </Card>

      {/* Dialog de saisie manuelle */}
      {showManualForm && selectedAdherent && (
        <Dialog open={showManualForm} onOpenChange={setShowManualForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
              <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Edit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Saisir une Cotisation
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Pour {selectedAdherent.firstname} {selectedAdherent.lastname}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleManualCotisation} className="space-y-4 mt-6">
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                  <Euro className="h-3 w-3" />
                  Type de cotisation
                </Label>
                <Select
                  value={manualFormData.type}
                  onValueChange={(value) => setManualFormData({ ...manualFormData, type: value })}
                >
                  <SelectTrigger className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-9 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Forfait">Forfait</SelectItem>
                    <SelectItem value="Assistance">Assistance</SelectItem>
                    <SelectItem value="Anniversaire">Anniversaire</SelectItem>
                    <SelectItem value="Adhesion">Adhésion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                  <Euro className="h-3 w-3" />
                  Montant (€)
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualFormData.montant}
                  onChange={(e) => setManualFormData({ ...manualFormData, montant: parseFloat(e.target.value) || 0 })}
                  className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm h-9 sm:h-10"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                  <CreditCard className="h-3 w-3" />
                  Moyen de paiement
                </Label>
                <Select
                  value={manualFormData.moyenPaiement}
                  onValueChange={(value) => setManualFormData({ ...manualFormData, moyenPaiement: value })}
                >
                  <SelectTrigger className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-9 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Especes">Espèces</SelectItem>
                    <SelectItem value="Cheque">Chèque</SelectItem>
                    <SelectItem value="Virement">Virement</SelectItem>
                    <SelectItem value="CarteBancaire">Carte Bancaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                  <FileText className="h-3 w-3" />
                  Description
                </Label>
                <Input
                  value={manualFormData.description}
                  onChange={(e) => setManualFormData({ ...manualFormData, description: e.target.value })}
                  placeholder="Description optionnelle"
                  className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-9 sm:h-10"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                  <Info className="h-3 w-3" />
                  Référence
                </Label>
                <Input
                  value={manualFormData.reference}
                  onChange={(e) => setManualFormData({ ...manualFormData, reference: e.target.value })}
                  placeholder="Référence optionnelle (N° chèque, virement, etc.)"
                  className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-9 sm:h-10"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowManualForm(false);
                    setSelectedAdherent(null);
                  }}
                  className="bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900 text-xs sm:text-sm shadow-sm"
                >
                  Annuler
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Saisir la cotisation
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de consultation */}
      {showViewModal && (
        <Dialog open={showViewModal} onOpenChange={(open) => {
          if (!open) {
            setShowViewModal(false);
            setAdherentDetails(null);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4 border-b border-slate-200 dark:border-slate-700">
              <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Détails de l'adhérent
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Informations complètes sur l'adhérent et ses cotisations
              </DialogDescription>
            </DialogHeader>
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Chargement des détails...</p>
                </div>
              </div>
            ) : adherentDetails ? (
              <div className="space-y-4 mt-6">
                {/* Informations principales */}
                <Card className="shadow-sm border-slate-200 dark:border-slate-700 !py-0">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-slate-200 dark:border-slate-700 pb-2 pt-3 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Informations personnelles
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 px-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                          <User className="h-3 w-3" />
                          Nom complet
                        </Label>
                        <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                          {adherentDetails.firstname} {adherentDetails.lastname}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                          <Mail className="h-3 w-3" />
                          Email
                        </Label>
                        <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                          {adherentDetails.User?.email || "—"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                          <CheckCircle2 className="h-3 w-3" />
                          Statut
                        </Label>
                        <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 shadow-sm">
                          <Badge 
                            className={
                              adherentDetails.User?.status === "Actif" 
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }
                          >
                            {adherentDetails.User?.status || "—"}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                          <Euro className="h-3 w-3" />
                          Dette totale
                        </Label>
                        <div className={`p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-bold font-mono shadow-sm ${adherentDetails.totalDette > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {adherentDetails.totalDette.toFixed(2).replace('.', ',')} €
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Informations financières */}
                <Card className="shadow-sm border-slate-200 dark:border-slate-700 !py-0">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-slate-200 dark:border-slate-700 pb-2 pt-3 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                      <Euro className="h-4 w-4 text-green-600 dark:text-green-400" />
                      Informations financières
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 px-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                          <Clock className="h-3 w-3" />
                          Mois de retard
                        </Label>
                        <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 shadow-sm">
                          {adherentDetails.moisDeRetard > 0 ? (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              {adherentDetails.moisDeRetard} mois
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              À jour
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                          <Euro className="h-3 w-3" />
                          Montant forfait
                        </Label>
                        <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                          {adherentDetails.montantForfait.toFixed(2).replace('.', ',')} €
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                          <Euro className="h-3 w-3" />
                          Montant occasionnel
                        </Label>
                        <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                          {adherentDetails.montantOccasionnel.toFixed(2).replace('.', ',')} €
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                          <FileText className="h-3 w-3" />
                          Nombre de cotisations
                        </Label>
                        <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                          {adherentDetails._count?.Cotisations || 0}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              
                {/* Liste des cotisations */}
                {adherentDetails.Cotisations && adherentDetails.Cotisations.length > 0 && (
                  <Card className="shadow-sm border-slate-200 dark:border-slate-700 !py-0">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-slate-200 dark:border-slate-700 pb-2 pt-3 px-4">
                      <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                        <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        Dernières cotisations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3 px-4 pb-4">
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {adherentDetails.Cotisations.map((cotisation: any, index: number) => (
                          <Card key={index} className="p-3 border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="font-medium text-sm text-gray-900 dark:text-white">{cotisation.type}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(cotisation.dateCotisation).toLocaleDateString('fr-FR', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric' 
                                  })}
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                                  {Number(cotisation.montant).toFixed(2).replace('.', ',')} €
                                </div>
                                <Badge 
                                  className={
                                    cotisation.statut === 'Valide' 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                      : cotisation.statut === 'EnAttente'
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  }
                                >
                                  {cotisation.statut}
                                </Badge>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucune donnée disponible</p>
              </div>
            )}
            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowViewModal(false);
                  setAdherentDetails(null);
                }}
                className="bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900 text-xs sm:text-sm shadow-sm"
              >
                <X className="h-4 w-4 mr-2" />
                Fermer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog d'encaissement */}
      {showPaiementDialog && paiementAdherent && (
        <Dialog open={showPaiementDialog} onOpenChange={setShowPaiementDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Encaisser un Paiement</DialogTitle>
              <DialogDescription>
                Pour {paiementAdherent.firstname} {paiementAdherent.lastname}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!paiementAdherent) return;

                try {
                  const result = await createPaiementGeneral({
                    adherentId: paiementAdherent.id,
                    montant: parseFloat(paiementFormData.montant),
                    datePaiement: paiementFormData.datePaiement,
                    moyenPaiement: paiementFormData.moyenPaiement,
                    reference: paiementFormData.reference || undefined,
                    description: paiementFormData.description || undefined,
                  });

                  if (result.success) {
                    toast.success(result.message);
                    setShowPaiementDialog(false);
                    setPaiementAdherent(null);
                    setPaiementFormData({
                      montant: "",
                      datePaiement: new Date().toISOString().split('T')[0],
                      moyenPaiement: "Especes",
                      reference: "",
                      description: "",
                    });
                    loadAdherents();
                  } else {
                    toast.error(result.error || "Erreur lors de l'enregistrement");
                  }
                } catch (error) {
                  console.error("Erreur:", error);
                  toast.error("Erreur lors de l'enregistrement du paiement");
                }
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="montant">Montant à encaisser (€) *</Label>
                <Input
                  id="montant"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={paiementFormData.montant}
                  onChange={(e) => setPaiementFormData({ ...paiementFormData, montant: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Montant suggéré pour annuler la dette: <strong>{paiementAdherent.montantAPayerPourAnnulerDette.toFixed(2)}€</strong>
                  <br />
                  <span className="text-blue-600 dark:text-blue-400">
                    • Si le montant est <strong>inférieur</strong> : la dette sera réduite du montant saisi
                    <br />
                    • Si le montant est <strong>supérieur</strong> : la dette sera annulée et l'excédent créera un avoir
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="datePaiement">Date de paiement *</Label>
                  <Input
                    id="datePaiement"
                    type="date"
                    required
                    value={paiementFormData.datePaiement}
                    onChange={(e) => setPaiementFormData({ ...paiementFormData, datePaiement: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="moyenPaiement">Moyen de paiement *</Label>
                  <Select
                    value={paiementFormData.moyenPaiement}
                    onValueChange={(value: any) => setPaiementFormData({ ...paiementFormData, moyenPaiement: value })}
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
              </div>

              <div>
                <Label htmlFor="reference">Référence</Label>
                <Input
                  id="reference"
                  value={paiementFormData.reference}
                  onChange={(e) => setPaiementFormData({ ...paiementFormData, reference: e.target.value })}
                  placeholder="N° de chèque, virement, etc."
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={paiementFormData.description}
                  onChange={(e) => setPaiementFormData({ ...paiementFormData, description: e.target.value })}
                  placeholder="Description optionnelle"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPaiementDialog(false);
                    setPaiementAdherent(null);
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit">
                  Encaisser
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </div>
  );
}
