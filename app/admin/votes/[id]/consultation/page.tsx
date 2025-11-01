"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { getAllVotesForAdmin } from "@/actions/elections";

const getStatusColor = (status: string) => {
  switch (status) {
    case "Valide":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Blanc":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    case "Annule":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "Valide":
      return "Valide";
    case "Blanc":
      return "Blanc";
    case "Annule":
      return "Annulé";
    default:
      return status;
  }
};

export default function ConsultationVotePage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [vote, setVote] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadVote();
    }
  }, [id]);

  const loadVote = async () => {
    try {
      setLoading(true);
      const res = await getAllVotesForAdmin();
      if (res.success && res.votes) {
        const found = res.votes.find((v: any) => v.id === id);
        if (found) {
          setVote(found);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Modal title="Détails du vote" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!vote) {
    return (
      <Modal title="Détails du vote" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Vote introuvable
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Détails du vote" confirmOnClose={false}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Élection</Label>
            <div className="text-sm mt-1">{vote.election?.titre}</div>
          </div>
          <div>
            <Label>Poste</Label>
            <div className="text-sm mt-1">{vote.position?.titre}</div>
          </div>
          <div>
            <Label>Adhérent</Label>
            <div className="text-sm mt-1">{vote.adherent?.User?.name || vote.adherent?.User?.email}</div>
          </div>
          <div>
            <Label>Choix</Label>
            <div className="text-sm mt-1">{vote.candidacy?.adherent?.User?.name || (vote.status === "Blanc" ? "Blanc" : "—")}</div>
          </div>
          <div>
            <Label>Statut</Label>
            <div className="text-sm mt-1">
              <Badge className={`${getStatusColor(vote.status)} text-xs`}>{getStatusLabel(vote.status)}</Badge>
            </div>
          </div>
          {vote.createdAt && (
            <div>
              <Label>Date</Label>
              <div className="text-sm mt-1">{new Date(vote.createdAt).toLocaleDateString()}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

