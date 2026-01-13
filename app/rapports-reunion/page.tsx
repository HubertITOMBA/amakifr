"use client";

import { useState, useEffect, useCallback } from "react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  FileText, 
  Search, 
  Calendar,
  Printer,
  Eye,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getRapportsReunionForAdherents, getRapportReunionById } from "@/actions/rapports-reunion";
import { toast } from "sonner";

export default function RapportsReunionPage() {
  const [rapports, setRapports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedRapport, setSelectedRapport] = useState<any>(null);

  const loadRapports = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getRapportsReunionForAdherents();
      if (result.success && result.rapports) {
        setRapports(result.rapports);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
        setRapports([]);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des rapports");
      setRapports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRapports();
  }, [loadRapports]);

  const handleView = async (rapport: any) => {
    try {
      const result = await getRapportReunionById(rapport.id);
      if (result.success && result.rapport) {
        setSelectedRapport(result.rapport);
        setShowViewDialog(true);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement du rapport");
    }
  };

  const handlePrint = (rapport: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${rapport.titre}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            h1 {
              color: #1e40af;
              border-bottom: 2px solid #1e40af;
              padding-bottom: 10px;
            }
            .meta {
              color: #666;
              margin-bottom: 20px;
            }
            .contenu {
              line-height: 1.6;
              white-space: pre-wrap;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>${rapport.titre}</h1>
          <div class="meta">
            <p><strong>Date de la réunion :</strong> ${format(new Date(rapport.dateReunion), "dd MMMM yyyy", { locale: fr })}</p>
            <p><strong>Créé le :</strong> ${format(new Date(rapport.createdAt), "dd MMMM yyyy à HH:mm", { locale: fr })}</p>
            ${rapport.CreatedBy ? `<p><strong>Créé par :</strong> ${rapport.CreatedBy.name || rapport.CreatedBy.email}</p>` : ''}
          </div>
          <div class="contenu">${rapport.contenu}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const filteredRapports = rapports.filter(rapport => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      rapport.titre.toLowerCase().includes(search) ||
      rapport.contenu.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <DynamicNavbar />
      
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Rapports de Réunion
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Consultez les comptes rendus de nos réunions mensuelles
            </p>
          </div>

          <Card className="shadow-lg border-blue-200">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Rapports disponibles ({filteredRapports.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {/* Recherche */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un rapport..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : filteredRapports.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {searchTerm ? "Aucun rapport ne correspond à votre recherche" : "Aucun rapport disponible pour le moment"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRapports.map((rapport) => (
                    <Card key={rapport.id} className="border-gray-200 hover:border-blue-300 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                              {rapport.titre}
                            </h3>
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>
                                  {format(new Date(rapport.dateReunion), "dd MMMM yyyy", { locale: fr })}
                                </span>
                              </div>
                              {rapport.CreatedBy && (
                                <span>
                                  Par {rapport.CreatedBy.name || "Administrateur"}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 line-clamp-2">
                              {rapport.contenu.substring(0, 200)}...
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleView(rapport)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Lire
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePrint(rapport)}
                            >
                              <Printer className="h-4 w-4 mr-2" />
                              Imprimer
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Dialog de visualisation */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRapport?.titre}</DialogTitle>
            <DialogDescription>
              <div className="space-y-1 mt-2">
                <p><strong>Date de la réunion :</strong> {selectedRapport && format(new Date(selectedRapport.dateReunion), "dd MMMM yyyy", { locale: fr })}</p>
                <p><strong>Créé le :</strong> {selectedRapport && format(new Date(selectedRapport.createdAt), "dd MMMM yyyy à HH:mm", { locale: fr })}</p>
                {selectedRapport?.CreatedBy && (
                  <p><strong>Créé par :</strong> {selectedRapport.CreatedBy.name || selectedRapport.CreatedBy.email}</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg whitespace-pre-wrap text-sm">
              {selectedRapport?.contenu}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Fermer
            </Button>
            {selectedRapport && (
              <Button onClick={() => handlePrint(selectedRapport)}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
