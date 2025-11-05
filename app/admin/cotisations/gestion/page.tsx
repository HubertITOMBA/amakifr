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
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import { getAdherentsWithCotisations, createManualCotisation, updateCotisation } from "@/actions/cotisations";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";

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
  const [adherentDetails, setAdherentDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    type: "Forfait",
    montant: 15,
    moyenPaiement: "Especes",
    description: "",
    reference: "",
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
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                  {adherent.firstname[0]}{adherent.lastname[0]}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
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
              <span className={`font-bold ${dette > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {dette.toFixed(2).replace('.', ',')} €
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "moisDeRetard",
        header: "Mois de Retard",
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
        accessorKey: "montantForfait",
        header: "Forfait",
        cell: ({ row }) => {
          const montant = row.getValue("montantForfait") as number;
          return (
            <div className="text-right">
              <span className="font-medium text-gray-900 dark:text-white">
                {montant.toFixed(2).replace('.', ',')} €
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "montantOccasionnel",
        header: "Occasionnel",
        cell: ({ row }) => {
          const montant = row.getValue("montantOccasionnel") as number;
          return (
            <div className="text-right">
              <span className="font-medium text-gray-900 dark:text-white">
                {montant.toFixed(2).replace('.', ',')} €
              </span>
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
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedAdherent(adherent);
                  setShowManualForm(true);
                }}
                className="text-blue-600 hover:text-blue-700"
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
                className="text-green-600 hover:text-green-700"
              >
                <Eye className="h-3 w-3 mr-1" />
                Voir
              </Button>
              {adherent.enRetard && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Relancer
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
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Gestion des Cotisations
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Suivi des cotisations et gestion des adhérents
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => window.location.href = '/admin/cotisations'}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Créer Cotisations
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Total Adhérents
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {adherents.length}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  En Retard
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {adherentsEnRetard}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Total Dettes
                </p>
                <p className="text-2xl font-bold text-orange-600">
                  {totalDettes.toFixed(2).replace('.', ',')} €
                </p>
              </div>
              <Euro className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tableau */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Liste des Adhérents</CardTitle>
              <CardDescription>
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
        <CardContent>
          {/* Filtres */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un adhérent..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select
              value={(table.getColumn("status")?.getFilterValue() as string) ?? ""}
              onValueChange={(value) =>
                table.getColumn("status")?.setFilterValue(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-40">
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
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b bg-gray-50 dark:bg-gray-800">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
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
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-4 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              {table.getFilteredRowModel().rows.length} adhérent(s) au total
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
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
          <Card className="w-full max-w-md">
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
    </div>
  );
}
