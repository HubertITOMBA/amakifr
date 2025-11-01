"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { getPosteTemplateById } from "@/actions/postes";

export default function ConsultationPostePage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [poste, setPoste] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadPoste();
    }
  }, [id]);

  const loadPoste = async () => {
    try {
      setLoading(true);
      const result = await getPosteTemplateById(id);
      if (result.success && result.data) {
        setPoste(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Modal title="Détails du poste" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!poste) {
    return (
      <Modal title="Détails du poste" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Poste introuvable
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Détails du poste" confirmOnClose={false}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Code</Label>
            <div className="text-sm mt-1">{poste.code}</div>
          </div>
          <div>
            <Label>Libellé</Label>
            <div className="text-sm mt-1 font-medium">{poste.libelle}</div>
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <div className="text-sm mt-1 whitespace-pre-wrap">{poste.description || "—"}</div>
          </div>
          <div>
            <Label>Ordre d'affichage</Label>
            <div className="text-sm mt-1">{poste.ordre}</div>
          </div>
          <div>
            <Label>Statut</Label>
            <div className="text-sm mt-1">
              <Badge className={poste.actif ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"}>
                {poste.actif ? "Actif" : "Inactif"}
              </Badge>
            </div>
          </div>
          <div>
            <Label>Nombre de mandats par défaut</Label>
            <div className="text-sm mt-1">{poste.nombreMandatsDefaut}</div>
          </div>
          <div>
            <Label>Durée du mandat (mois)</Label>
            <div className="text-sm mt-1">{poste.dureeMandatDefaut || "—"}</div>
          </div>
          <div>
            <Label>Nombre d'utilisations</Label>
            <div className="text-sm mt-1">{poste._count?.positions || 0}</div>
          </div>
          {poste.createdAt && (
            <div>
              <Label>Date de création</Label>
              <div className="text-sm mt-1">{new Date(poste.createdAt).toLocaleDateString()}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

