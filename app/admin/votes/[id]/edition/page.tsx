"use client";

import { useParams, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { getAllVotesForAdmin, adminUpdateVote, getCandidaciesForPositionLight } from "@/actions/elections";
import { toast } from "sonner";

export default function EditionVotePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [isDirty, setIsDirty] = useState(false);
  const [vote, setVote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ candidacyId?: string | null; status: string }>({
    candidacyId: null,
    status: "Valide",
  });
  const [initialForm, setInitialForm] = useState(form);
  const [candidaciesOptions, setCandidaciesOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [candidacySearch, setCandidacySearch] = useState("");

  const filteredCandidacies = candidaciesOptions.filter(o => !candidacySearch.trim() || o.label.toLowerCase().includes(candidacySearch.trim().toLowerCase()));

  useEffect(() => {
    if (id) {
      loadVote();
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialForm));
  }, [form, initialForm]);

  useEffect(() => {
    if (vote?.position?.id) {
      loadCandidacies();
    }
  }, [vote?.position?.id]);

  const loadVote = async () => {
    try {
      setLoading(true);
      const res = await getAllVotesForAdmin();
      if (res.success && res.votes) {
        const found = res.votes.find((v: any) => v.id === id);
        if (found) {
          setVote(found);
          const init = {
            candidacyId: found.candidacy?.id || null,
            status: found.status || "Valide",
          };
          setForm(init);
          setInitialForm(init);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCandidacies = async () => {
    if (!vote?.position?.id) return;
    const res = await getCandidaciesForPositionLight(vote.position.id);
    if (res.success) setCandidaciesOptions((res.candidacies || []).map(c => ({ id: c.id, label: c.label })));
  };

  const handleSave = async () => {
    if (!vote) return;
    try {
      const payload: any = {};
      if (form.candidacyId !== initialForm.candidacyId) payload.candidacyId = form.candidacyId || null;
      if (form.status !== initialForm.status) payload.status = form.status as any;
      if (!Object.keys(payload).length) {
        toast.message("Aucun changement détecté");
        return;
      }
      const res = await adminUpdateVote(vote.id, payload);
      if (res.success) {
        toast.success("Vote mis à jour");
        router.back();
      } else {
        toast.error(res.error || "Erreur lors de la mise à jour");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  if (loading) {
    return (
      <Modal title="Éditer le vote" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!vote) {
    return (
      <Modal title="Éditer le vote" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Vote introuvable
        </div>
      </Modal>
    );
  }

  return (
    <Modal 
      title="Éditer le vote" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Enregistrer"
      onSave={handleSave}
      onCancel={() => router.back()}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Adhérent</Label>
            <Input value={vote.adherent?.User?.name || vote.adherent?.User?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Élection</Label>
            <Input value={vote.election?.titre || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Poste</Label>
            <Input value={vote.position?.titre || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Candidat (changer)</Label>
            <Input placeholder="Rechercher un candidat..." className="mb-2" value={candidacySearch} onChange={(e) => setCandidacySearch(e.target.value)} />
            <Select value={form.candidacyId || "none"} onValueChange={(v) => setForm({ ...form, candidacyId: v === "none" ? null : v })}>
              <SelectTrigger>
                <SelectValue placeholder={vote.candidacy?.adherent?.User?.name || "Vote blanc"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Vote blanc</SelectItem>
                {filteredCandidacies.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Statut du vote</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Valide">Valide</SelectItem>
                <SelectItem value="Blanc">Blanc</SelectItem>
                <SelectItem value="Annule">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Modal>
  );
}

