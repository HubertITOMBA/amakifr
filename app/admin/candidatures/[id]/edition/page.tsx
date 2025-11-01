"use client";

import { useParams, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { getCandidacyById, adminUpdateCandidacy, getPositionsForElectionLight } from "@/actions/elections";
import { CandidacyStatus } from "@prisma/client";
import { toast } from "sonner";

export default function EditionCandidaturePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [isDirty, setIsDirty] = useState(false);
  const [candidacy, setCandidacy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ positionId: string; motivation: string; programme: string; status: CandidacyStatus }>({
    positionId: "",
    motivation: "",
    programme: "",
    status: CandidacyStatus.EnAttente,
  });
  const [initialForm, setInitialForm] = useState(form);
  const [positionsOptions, setPositionsOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [positionSearch, setPositionSearch] = useState("");

  const filteredPositions = positionsOptions.filter(o => !positionSearch.trim() || o.label.toLowerCase().includes(positionSearch.trim().toLowerCase()));

  useEffect(() => {
    if (id) {
      loadCandidacy();
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialForm));
  }, [form, initialForm]);

  useEffect(() => {
    if (candidacy?.position?.election?.id) {
      loadPositions();
    }
  }, [candidacy?.position?.election?.id]);

  const loadCandidacy = async () => {
    try {
      setLoading(true);
      const result = await getCandidacyById(id);
      if (result.success && result.data) {
        setCandidacy(result.data);
        const init = {
          positionId: result.data.position?.id || "",
          motivation: result.data.motivation || "",
          programme: result.data.programme || "",
          status: result.data.status || CandidacyStatus.EnAttente,
        };
        setForm(init);
        setInitialForm(init);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPositions = async () => {
    if (!candidacy?.position?.election?.id) return;
    const res = await getPositionsForElectionLight(candidacy.position.election.id);
    if (res.success) setPositionsOptions((res.positions || []).map(p => ({ id: p.id, label: p.titre })));
  };

  const handleSave = async () => {
    if (!candidacy) return;
    try {
      const payload: any = { motivation: form.motivation, programme: form.programme, status: form.status };
      if (form.positionId && form.positionId !== initialForm.positionId) payload.positionId = form.positionId;
      const statusChanged = form.status !== initialForm.status;
      const res = await adminUpdateCandidacy(candidacy.id, payload);
      if (res.success) {
        if (statusChanged) {
          toast.success("Candidature mise à jour. Un email de notification a été envoyé au candidat.");
        } else {
          toast.success("Candidature mise à jour");
        }
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
      <Modal title="Éditer la candidature" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!candidacy) {
    return (
      <Modal title="Éditer la candidature" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Candidature introuvable
        </div>
      </Modal>
    );
  }

  return (
    <Modal 
      title="Éditer la candidature" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Enregistrer"
      onSave={handleSave}
      onCancel={() => router.back()}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Adhérent</Label>
            <Input value={`${candidacy.adherent?.firstname || ''} ${candidacy.adherent?.lastname || ''}`.trim()} disabled />
          </div>
          <div>
            <Label>Élection</Label>
            <Input value={candidacy.position?.election?.titre || ""} disabled />
          </div>
          <div>
            <Label>Poste (changer)</Label>
            <Input placeholder="Rechercher un poste..." className="mb-2" value={positionSearch} onChange={(e) => setPositionSearch(e.target.value)} />
            <Select value={form.positionId} onValueChange={(v) => setForm({ ...form, positionId: v })}>
              <SelectTrigger>
                <SelectValue placeholder={candidacy.position?.titre || "Choisir un poste"} />
              </SelectTrigger>
              <SelectContent>
                {filteredPositions.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="motivation">Motivation</Label>
            <Textarea id="motivation" rows={3} value={form.motivation} onChange={(e) => setForm({ ...form, motivation: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="programme">Programme</Label>
            <Textarea id="programme" rows={3} value={form.programme} onChange={(e) => setForm({ ...form, programme: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Statut</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CandidacyStatus })}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CandidacyStatus.EnAttente}>En attente</SelectItem>
              <SelectItem value={CandidacyStatus.Validee}>Validée</SelectItem>
              <SelectItem value={CandidacyStatus.Rejetee}>Rejetée</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Modal>
  );
}

