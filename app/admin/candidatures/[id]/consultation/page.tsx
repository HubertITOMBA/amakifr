"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { getCandidacyById } from "@/actions/elections";
import { CandidacyStatus } from "@prisma/client";

const getStatusColor = (status: CandidacyStatus) => {
  switch (status) {
    case CandidacyStatus.Validee:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case CandidacyStatus.Rejetee:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case CandidacyStatus.EnAttente:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatusLabel = (status: CandidacyStatus) => {
  switch (status) {
    case CandidacyStatus.Validee:
      return "Validée";
    case CandidacyStatus.Rejetee:
      return "Rejetée";
    case CandidacyStatus.EnAttente:
      return "En attente";
    default:
      return status;
  }
};

export default function ConsultationCandidaturePage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [candidacy, setCandidacy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadCandidacy();
    }
  }, [id]);

  const loadCandidacy = async () => {
    try {
      setLoading(true);
      const result = await getCandidacyById(id);
      if (result.success && result.data) {
        setCandidacy(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Modal title="Détails de la candidature" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!candidacy) {
    return (
      <Modal title="Détails de la candidature" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Candidature introuvable
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Détails de la candidature" confirmOnClose={false}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Candidat</Label>
            <div className="text-sm mt-1">{candidacy.adherent?.civility} {candidacy.adherent?.firstname} {candidacy.adherent?.lastname}</div>
          </div>
          <div>
            <Label>Email</Label>
            <div className="text-sm mt-1">{candidacy.adherent?.User?.email}</div>
          </div>
          <div>
            <Label>Élection</Label>
            <div className="text-sm mt-1">{candidacy.position?.election?.titre}</div>
          </div>
          <div>
            <Label>Poste</Label>
            <div className="text-sm mt-1">{candidacy.position?.titre}</div>
          </div>
          <div>
            <Label>Statut</Label>
            <div className="text-sm mt-1">
              <Badge className={`${getStatusColor(candidacy.status)} text-xs`}>{getStatusLabel(candidacy.status)}</Badge>
            </div>
          </div>
          {candidacy.createdAt && (
            <div>
              <Label>Date de candidature</Label>
              <div className="text-sm mt-1">{new Date(candidacy.createdAt).toLocaleDateString()}</div>
            </div>
          )}
        </div>
        {candidacy.motivation && (
          <div>
            <Label>Motivation</Label>
            <div className="text-sm mt-1 whitespace-pre-wrap">{candidacy.motivation}</div>
          </div>
        )}
        {candidacy.programme && (
          <div>
            <Label>Programme</Label>
            <div className="text-sm mt-1 whitespace-pre-wrap">{candidacy.programme}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}

