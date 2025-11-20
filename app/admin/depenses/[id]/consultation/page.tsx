"use client";

import { useParams, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Image, File, Download, ExternalLink, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { getDepenseById } from "@/actions/depenses";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Justificatif {
  id: string;
  nomFichier: string;
  chemin: string;
  typeMime: string;
  taille: number;
  createdAt: string;
  UploadedBy?: {
    email: string;
  };
}

const getFileIcon = (typeMime: string) => {
  if (typeMime.startsWith("image/")) {
    return <Image className="h-5 w-5 text-blue-500" />;
  } else if (typeMime === "application/pdf") {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  return <File className="h-5 w-5 text-gray-500" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

export default function ConsultationDepensePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [depense, setDepense] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadDepense();
    }
  }, [id]);

  const loadDepense = async () => {
    try {
      setLoading(true);
      const result = await getDepenseById(id);
      if (result.success && result.data) {
        setDepense(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Modal title="Détails de la dépense" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!depense) {
    return (
      <Modal title="Détails de la dépense" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Dépense introuvable
        </div>
      </Modal>
    );
  }

  const justificatifs: Justificatif[] = depense.Justificatifs || [];

  return (
    <Modal 
      title="Détails de la dépense" 
      confirmOnClose={false}
      showFooter={false}
      onCancel={() => router.back()}
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto">
        {/* Informations de la dépense */}
        <Card className="!py-0 border-blue-200 dark:border-blue-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-gray-800">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Informations de la dépense
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="libelle">Libellé *</Label>
                  <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {depense.libelle || "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="montant">Montant *</Label>
                  <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-bold text-gray-900 dark:text-gray-100">
                    {Number(depense.montant).toFixed(2).replace('.', ',')} €
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateDepense">Date *</Label>
                  <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {format(new Date(depense.dateDepense), 'dd MMMM yyyy', { locale: fr })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="typeDepenseId">Type de dépense</Label>
                  <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                    {depense.TypeDepense ? (
                      <Badge variant="outline" className="text-xs">
                        {depense.TypeDepense.titre}
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categorie">Catégorie (ancien système)</Label>
                  <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {depense.categorie || "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="statut">Statut</Label>
                  <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                    <Badge 
                      className={
                        depense.statut === "Valide" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700"
                          : depense.statut === "Rejete"
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700"
                      }
                    >
                      {depense.statut}
                    </Badge>
                  </div>
                </div>
                {depense.CreatedBy && (
                  <div className="space-y-2">
                    <Label htmlFor="createdBy">Créé par</Label>
                    <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {depense.CreatedBy.email}
                    </div>
                  </div>
                )}
                {depense.createdAt && (
                  <div className="space-y-2">
                    <Label htmlFor="createdAt">Date de création</Label>
                    <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {format(new Date(depense.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <div className="p-2.5 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap min-h-[80px]">
                    {depense.description || "—"}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Justificatifs */}
        <Card className="!py-0 border-orange-200 dark:border-orange-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-900/20 dark:to-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                Justificatifs
                {justificatifs.length > 0 && (
                  <Badge variant="outline" className="ml-2 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300">
                    {justificatifs.length}
                  </Badge>
                )}
              </h3>
            </div>

            <div className="space-y-4">
              {justificatifs.length === 0 ? (
                depense.justificatif ? (
                  // Ancien système : un seul justificatif
                  <Card className="!py-0 border-gray-200 dark:border-gray-700">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-blue-500" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              Justificatif (ancien système)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(depense.justificatif, '_blank')}
                            className="h-8 w-8 p-0 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
                            title="Voir le justificatif"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <a href={depense.justificatif} download>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/20"
                              title="Télécharger le justificatif"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="!py-0 border-dashed">
                    <CardContent className="p-6 text-center">
                      <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Aucun justificatif associé à cette dépense
                      </p>
                    </CardContent>
                  </Card>
                )
              ) : (
                <div className="space-y-2">
                  {justificatifs.map((justificatif) => (
                    <Card key={justificatif.id} className="!py-0 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {getFileIcon(justificatif.typeMime)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {justificatif.nomFichier}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {formatFileSize(justificatif.taille)}
                                </Badge>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {format(new Date(justificatif.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(justificatif.chemin, '_blank')}
                              className="h-8 w-8 p-0 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
                              title="Voir le justificatif"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <a href={justificatif.chemin} download={justificatif.nomFichier}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0 border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/20"
                                title="Télécharger le justificatif"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Modal>
  );
}
