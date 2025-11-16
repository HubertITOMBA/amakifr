"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Info
} from "lucide-react";
import { toast } from "sonner";
import { getAdherentsWithCotisations, createManualCotisation, updateCotisation } from "@/actions/cotisations";
import { createPaiementGeneral } from "@/actions/paiements";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
  montantAPayerPourAnnulerDette: number;
  totalAvoirs: number;
}

export default function AdminCotisationManagement() {
  const [adherents, setAdherents] = useState<AdherentWithCotisations[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedAdherent, setSelectedAdherent] = useState<AdherentWithCotisations | null>(null);
  
  // Visibilité des colonnes - charger depuis localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-cotisations-column-visibility");
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences de colonnes:", error);
      }
    }
    return {};
  });
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
        setAdherents(result.data as unknown as AdherentWithCotisations[]);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
      }
    } catch (error) {
      toast.error("Erreur lors du chargement des adhérents");
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnDef<AdherentWithCotisations>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Adhérent",
        cell: ({ row }) => {
          const adherent = row.original;
          return (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-300">
                  {adherent.firstname[0]}{adherent.lastname[0]}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {adherent.civility} {adherent.firstname} {adherent.lastname}
                </p>
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
        header: "Forfait",
        cell: ({ row }) => {
          const montant = row.getValue("forfaitMoisCourant") as number;
          return (
            <div className="text-right">
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {montant.toFixed(2).replace('.', ',')} €
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "assistanceMoisCourant",
        header: "Assistance",
        cell: ({ row }) => {
          const montant = row.getValue("assistanceMoisCourant") as number;
          return (
            <div className="text-right">
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                {montant.toFixed(2).replace('.', ',')} €
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "montantAPayerPourAnnulerDette",
        header: "A Payer",
        cell: ({ row }) => {
          const montant = row.getValue("montantAPayerPourAnnulerDette") as number;
          return (
            <div className="text-right">
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
        header: "Actions",
        meta: { forceVisible: true }, // Cette colonne ne peut pas être masquée
        cell: ({ row }) => {
          const adherent = row.original;
          return (
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedAdherent(adherent);
                  setShowManualForm(true);
                }}
                className="text-blue-600 hover:text-blue-700 h-7 px-2 text-xs"
              >
                <Edit className="h-3 w-3 mr-1" />
                Saisir
              </Button>
              <Button
                size="sm"
                variant="outline"
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
                className="text-green-600 hover:text-green-700 h-7 px-2 text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                Voir
              </Button>
              {adherent.enRetard && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 h-7 px-2 text-xs"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Relancer
                </Button>
              )}
              {adherent.montantAPayerPourAnnulerDette > 0 && (
                <Button
                  size="sm"
                  variant="outline"
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
                  className="text-purple-600 hover:text-purple-700 h-7 px-2 text-xs"
                >
                  <CreditCard className="h-3 w-3 mr-1" />
                  Encaisser
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    []
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

  const totalDettes = adherents.reduce((sum, adherent) => sum + adherent.totalDette, 0);
  const adherentsEnRetard = adherents.filter(adherent => adherent.enRetard).length;

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
      <div className="space-y-6 p-6">
        {/* En-tête */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
              Gestion des Cotisations
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-2 text-lg">
              Suivi des cotisations et gestion des adhérents
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => window.location.href = '/admin/cotisations'}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Créer Cotisations
            </Button>
          </div>
        </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="!py-0 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Total Adhérents
                </p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                  {adherents.length}
                </p>
              </div>
              <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Users className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="!py-0 border-red-200 dark:border-red-800 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide">
                  En Retard
                </p>
                <p className="text-3xl font-bold text-red-900 dark:text-red-100 mt-2">
                  {adherentsEnRetard}
                </p>
              </div>
              <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="!py-0 border-orange-200 dark:border-orange-800 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                  Total Dettes
                </p>
                <p className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-2">
                  {totalDettes.toFixed(2).replace('.', ',')} €
                </p>
              </div>
              <div className="h-14 w-14 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
                <Euro className="h-7 w-7 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau */}
      <Card className="!py-0 shadow-xl border-blue-200 dark:border-blue-800">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl font-bold text-white flex items-center gap-3">
                <Users className="h-6 w-6" />
                Liste des Adhérents
              </CardTitle>
              <CardDescription className="text-blue-100 dark:text-blue-200 mt-2 text-base">
                Gestion des cotisations et suivi des dettes
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
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
                      doc.text(`${adherent.civility || ''} ${adherent.firstname} ${adherent.lastname}`.trim(), 20, yPos);
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
        <CardContent className="pt-6 pb-4 px-6">
          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un adhérent..."
                value={globalFilter as string}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 border-gray-300 dark:border-gray-600"
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
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wider"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {table.getRowModel().rows.map((row, index) => (
                  <tr 
                    key={row.id} 
                    className={`
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
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 whitespace-nowrap text-gray-900 dark:text-gray-100">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white dark:bg-gray-800 mt-5 flex items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 px-6">
            <div className="flex-1 text-sm text-muted-foreground dark:text-gray-400">
              {table.getFilteredRowModel().rows.length} adhérent(s) au total
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-gray-300 dark:border-gray-600"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-gray-300 dark:border-gray-600"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de saisie manuelle */}
      {showManualForm && selectedAdherent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="!py-0 w-full max-w-md">
            <CardHeader>
              <CardTitle>Saisir une Cotisation</CardTitle>
              <CardDescription>
                Pour {selectedAdherent.civility} {selectedAdherent.firstname} {selectedAdherent.lastname}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleManualCotisation} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={manualFormData.type}
                    onValueChange={(value) => setManualFormData({ ...manualFormData, type: value })}
                  >
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Montant</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={manualFormData.montant}
                    onChange={(e) => setManualFormData({ ...manualFormData, montant: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Moyen de Paiement</label>
                  <Select
                    value={manualFormData.moyenPaiement}
                    onValueChange={(value) => setManualFormData({ ...manualFormData, moyenPaiement: value })}
                  >
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={manualFormData.description}
                    onChange={(e) => setManualFormData({ ...manualFormData, description: e.target.value })}
                    placeholder="Description optionnelle"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Référence</label>
                  <Input
                    value={manualFormData.reference}
                    onChange={(e) => setManualFormData({ ...manualFormData, reference: e.target.value })}
                    placeholder="Référence optionnelle"
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowManualForm(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                    Saisir
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de consultation */}
      {showViewModal && (
        <Modal 
          title="Détails de l'adhérent" 
          confirmOnClose={false}
          showClose={true}
          onCancel={() => {
            setShowViewModal(false);
            setAdherentDetails(null);
          }}
        >
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : adherentDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nom complet</Label>
                  <div className="text-sm mt-1">
                    {adherentDetails.civility} {adherentDetails.firstname} {adherentDetails.lastname}
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="text-sm mt-1">{adherentDetails.User.email}</div>
                </div>
                <div>
                  <Label>Statut</Label>
                  <div className="text-sm mt-1">
                    <Badge 
                      className={
                        adherentDetails.User.status === "Actif" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }
                    >
                      {adherentDetails.User.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Dette totale</Label>
                  <div className={`text-sm mt-1 font-bold ${adherentDetails.totalDette > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {adherentDetails.totalDette.toFixed(2).replace('.', ',')} €
                  </div>
                </div>
                <div>
                  <Label>Mois de retard</Label>
                  <div className="text-sm mt-1">
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
                <div>
                  <Label>Montant forfait</Label>
                  <div className="text-sm mt-1">
                    {adherentDetails.montantForfait.toFixed(2).replace('.', ',')} €
                  </div>
                </div>
                <div>
                  <Label>Montant occasionnel</Label>
                  <div className="text-sm mt-1">
                    {adherentDetails.montantOccasionnel.toFixed(2).replace('.', ',')} €
                  </div>
                </div>
                <div>
                  <Label>Nombre de cotisations</Label>
                  <div className="text-sm mt-1">
                    {adherentDetails._count.Cotisations}
                  </div>
                </div>
              </div>
              
              {adherentDetails.Cotisations && adherentDetails.Cotisations.length > 0 && (
                <div className="mt-6">
                  <Label className="text-base font-semibold">Dernières cotisations</Label>
                  <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                    {adherentDetails.Cotisations.map((cotisation: any, index: number) => (
                      <Card key={index} className="p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{cotisation.type}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(cotisation.dateCotisation).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{Number(cotisation.montant).toFixed(2).replace('.', ',')} €</div>
                            <Badge 
                              className={
                                cotisation.statut === 'Valide' 
                                  ? 'bg-green-100 text-green-800' 
                                  : cotisation.statut === 'EnAttente'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }
                            >
                              {cotisation.statut}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Aucune donnée disponible
            </div>
          )}
        </Modal>
      )}

      {/* Dialog d'encaissement */}
      {showPaiementDialog && paiementAdherent && (
        <Dialog open={showPaiementDialog} onOpenChange={setShowPaiementDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Encaisser un Paiement</DialogTitle>
              <DialogDescription>
                Pour {paiementAdherent.civility} {paiementAdherent.firstname} {paiementAdherent.lastname}
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
