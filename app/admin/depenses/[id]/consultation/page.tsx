"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { getDepenseById } from "@/actions/depenses";

const getStatusColor = (statut: string) => {
  switch (statut) {
    case "Valide":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Rejete":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "EnAttente":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

export default function ConsultationDepensePage() {
  const params = useParams();
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

  return (
    <Modal title="Détails de la dépense" confirmOnClose={false}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Libellé</Label>
            <div className="text-sm mt-1 font-medium">{depense.libelle}</div>
          </div>
          <div>
            <Label>Montant</Label>
            <div className="text-sm mt-1 font-bold">{Number(depense.montant).toFixed(2).replace('.', ',')} €</div>
          </div>
          <div>
            <Label>Date</Label>
            <div className="text-sm mt-1">{new Date(depense.dateDepense).toLocaleDateString('fr-FR')}</div>
          </div>
          <div>
            <Label>Catégorie</Label>
            <div className="text-sm mt-1">{depense.categorie}</div>
          </div>
          <div>
            <Label>Statut</Label>
            <div className="text-sm mt-1">
              <Badge className={`${getStatusColor(depense.statut)} text-xs`}>{depense.statut}</Badge>
            </div>
          </div>
          {depense.justificatif && (
            <div>
              <Label>Justificatif</Label>
              <div className="text-sm mt-1">
                <a href={depense.justificatif} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Voir le fichier
                </a>
              </div>
            </div>
          )}
          {depense.CreatedBy && (
            <div>
              <Label>Créé par</Label>
              <div className="text-sm mt-1">{depense.CreatedBy.email}</div>
            </div>
          )}
          {depense.createdAt && (
            <div>
              <Label>Date de création</Label>
              <div className="text-sm mt-1">{new Date(depense.createdAt).toLocaleDateString('fr-FR')}</div>
            </div>
          )}
        </div>
        {depense.description && (
          <div>
            <Label>Description</Label>
            <div className="text-sm mt-1 whitespace-pre-wrap">{depense.description}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

