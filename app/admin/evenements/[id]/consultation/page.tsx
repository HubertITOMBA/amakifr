"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { getEvenementById } from "@/actions/evenements";

const getStatusColor = (statut: string) => {
  switch (statut) {
    case "Publie":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Archive":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Brouillon":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatusLabel = (statut: string) => {
  switch (statut) {
    case "Publie":
      return "Publié";
    case "Archive":
      return "Archivé";
    case "Brouillon":
      return "Brouillon";
    default:
      return statut;
  }
};

export default function ConsultationEvenementPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [evenement, setEvenement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadEvenement();
    }
  }, [id]);

  const loadEvenement = async () => {
    try {
      setLoading(true);
      const result = await getEvenementById(id);
      if (result.success && result.data) {
        setEvenement(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Modal title="Détails de l'événement" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!evenement) {
    return (
      <Modal title="Détails de l'événement" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Événement introuvable
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Détails de l'événement" confirmOnClose={false}>
      <div className="space-y-3 max-h-[80vh] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Titre</Label>
            <div className="text-sm mt-1 font-medium">{evenement.titre}</div>
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <div className="text-sm mt-1">{evenement.description}</div>
          </div>
          {evenement.contenu && (
            <div className="md:col-span-2">
              <Label>Contenu</Label>
              <div className="text-sm mt-1 whitespace-pre-wrap">{evenement.contenu}</div>
            </div>
          )}
          <div>
            <Label>Date de début</Label>
            <div className="text-sm mt-1">{new Date(evenement.dateDebut).toLocaleString('fr-FR')}</div>
          </div>
          {evenement.dateFin && (
            <div>
              <Label>Date de fin</Label>
              <div className="text-sm mt-1">{new Date(evenement.dateFin).toLocaleString('fr-FR')}</div>
            </div>
          )}
          <div>
            <Label>Date d'affichage</Label>
            <div className="text-sm mt-1">{new Date(evenement.dateAffichage).toLocaleString('fr-FR')}</div>
          </div>
          <div>
            <Label>Date de fin d'affichage</Label>
            <div className="text-sm mt-1">{new Date(evenement.dateFinAffichage).toLocaleString('fr-FR')}</div>
          </div>
          {evenement.lieu && (
            <div>
              <Label>Lieu</Label>
              <div className="text-sm mt-1">{evenement.lieu}</div>
            </div>
          )}
          {evenement.adresse && (
            <div>
              <Label>Adresse</Label>
              <div className="text-sm mt-1">{evenement.adresse}</div>
            </div>
          )}
          <div>
            <Label>Catégorie</Label>
            <div className="text-sm mt-1">
              <Badge variant="outline">{evenement.categorie}</Badge>
            </div>
          </div>
          <div>
            <Label>Statut</Label>
            <div className="text-sm mt-1">
              <Badge className={`${getStatusColor(evenement.statut)} text-xs`}>{getStatusLabel(evenement.statut)}</Badge>
            </div>
          </div>
          {evenement.prix !== null && evenement.prix !== undefined && (
            <div>
              <Label>Prix</Label>
              <div className="text-sm mt-1">{Number(evenement.prix).toFixed(2).replace('.', ',')} €</div>
            </div>
          )}
          {evenement.placesDisponibles !== null && evenement.placesDisponibles !== undefined && (
            <div>
              <Label>Places disponibles</Label>
              <div className="text-sm mt-1">{evenement.placesDisponibles}</div>
            </div>
          )}
          {evenement.inscriptionRequis && (
            <div>
              <Label>Inscription requise</Label>
              <div className="text-sm mt-1">Oui</div>
            </div>
          )}
          {evenement.dateLimiteInscription && (
            <div>
              <Label>Date limite d'inscription</Label>
              <div className="text-sm mt-1">{new Date(evenement.dateLimiteInscription).toLocaleString('fr-FR')}</div>
            </div>
          )}
          {evenement.contactEmail && (
            <div>
              <Label>Email de contact</Label>
              <div className="text-sm mt-1">{evenement.contactEmail}</div>
            </div>
          )}
          {evenement.contactTelephone && (
            <div>
              <Label>Téléphone de contact</Label>
              <div className="text-sm mt-1">{evenement.contactTelephone}</div>
            </div>
          )}
          {evenement.CreatedBy && (
            <div>
              <Label>Créé par</Label>
              <div className="text-sm mt-1">{evenement.CreatedBy.name || evenement.CreatedBy.email}</div>
            </div>
          )}
          {evenement.Inscriptions && evenement.Inscriptions.length > 0 && (
            <div className="md:col-span-2">
              <Label>Inscriptions ({evenement.Inscriptions.length})</Label>
              <div className="text-sm mt-1 space-y-1">
                {evenement.Inscriptions.map((insc: any, idx: number) => (
                  <div key={idx}>
                    {insc.Adherent?.civility} {insc.Adherent?.firstname} {insc.Adherent?.lastname}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

