"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdherentsLight } from "@/actions/user";
import { getElectionsLightForAdmin, getPositionsForElectionLight, getCandidaciesForPositionLight, adminCreateVote } from "@/actions/elections";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function GestionVotesPage() {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [form, setForm] = useState<{ adherentId: string; electionId: string; positionId: string; candidacyId?: string | null; status: string }>({
    adherentId: "",
    electionId: "",
    positionId: "",
    candidacyId: null,
    status: "Valide",
  });
  const [initialForm] = useState(form);

  // Options
  const [adherentsOptions, setAdherentsOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [electionsOptions, setElectionsOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [positionsOptions, setPositionsOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [candidaciesOptions, setCandidaciesOptions] = useState<Array<{ id: string; label: string }>>([]);

  // Recherche
  const [adherentSearch, setAdherentSearch] = useState("");
  const [electionSearch, setElectionSearch] = useState("");
  const [positionSearch, setPositionSearch] = useState("");
  const [candidacySearch, setCandidacySearch] = useState("");

  const filteredAdherents = adherentsOptions.filter(o => !adherentSearch.trim() || o.label.toLowerCase().includes(adherentSearch.trim().toLowerCase()));
  const filteredElections = electionsOptions.filter(o => !electionSearch.trim() || o.label.toLowerCase().includes(electionSearch.trim().toLowerCase()));
  const filteredPositions = positionsOptions.filter(o => !positionSearch.trim() || o.label.toLowerCase().includes(positionSearch.trim().toLowerCase()));
  const filteredCandidacies = candidaciesOptions.filter(o => !candidacySearch.trim() || o.label.toLowerCase().includes(candidacySearch.trim().toLowerCase()));

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialForm));
  }, [form, initialForm]);

  useEffect(() => {
    (async () => {
      const [adhRes, elecRes] = await Promise.all([
        getAdherentsLight(),
        getElectionsLightForAdmin(),
      ]);
      if (adhRes.success) setAdherentsOptions((adhRes.adherents || []).map((a: any) => ({ id: a.id, label: `${a.lastname || ''} ${a.firstname || ''} • ${a.email || ''}`.trim() })));
      if (elecRes.success) setElectionsOptions((elecRes.elections || []).map((e: any) => ({ id: e.id, label: e.titre })));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (form.electionId) {
        const res = await getPositionsForElectionLight(form.electionId);
        if (res.success) setPositionsOptions((res.positions || []).map(p => ({ id: p.id, label: p.titre })));
      } else {
        setPositionsOptions([]);
        setCandidaciesOptions([]);
      }
    })();
  }, [form.electionId]);

  useEffect(() => {
    (async () => {
      if (form.positionId) {
        const res = await getCandidaciesForPositionLight(form.positionId);
        if (res.success) setCandidaciesOptions((res.candidacies || []).map(c => ({ id: c.id, label: c.label })));
        else setCandidaciesOptions([]);
      } else {
        setCandidaciesOptions([]);
      }
    })();
  }, [form.positionId]);

  const handleSave = async () => {
    try {
      const res = await adminCreateVote({
        electionId: form.electionId,
        positionId: form.positionId,
        adherentId: form.adherentId,
        candidacyId: form.candidacyId || null,
        status: form.status as any,
      });
      if (res.success) {
        toast.success("Vote créé");
        router.back();
      } else {
        toast.error(res.error || "Erreur lors de la création");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  return (
    <Modal 
      title="Créer un vote" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Créer"
      onSave={handleSave}
      onCancel={() => router.back()}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Adhérent</Label>
            <Input placeholder="Rechercher un adhérent..." className="mb-2" value={adherentSearch} onChange={(e) => setAdherentSearch(e.target.value)} />
            <Select value={form.adherentId} onValueChange={(v) => setForm({ ...form, adherentId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un adhérent" />
              </SelectTrigger>
              <SelectContent>
                {filteredAdherents.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Élection</Label>
            <Input placeholder="Rechercher une élection..." className="mb-2" value={electionSearch} onChange={(e) => setElectionSearch(e.target.value)} />
            <Select value={form.electionId} onValueChange={(v) => setForm({ ...form, electionId: v, positionId: "", candidacyId: null })}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une élection" />
              </SelectTrigger>
              <SelectContent>
                {filteredElections.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Poste</Label>
            <Input placeholder="Rechercher un poste..." className="mb-2" value={positionSearch} onChange={(e) => setPositionSearch(e.target.value)} disabled={!form.electionId} />
            <Select value={form.positionId} onValueChange={(v) => setForm({ ...form, positionId: v, candidacyId: null })} disabled={!form.electionId}>
              <SelectTrigger>
                <SelectValue placeholder={form.electionId ? "Choisir un poste" : "Choisir d'abord une élection"} />
              </SelectTrigger>
              <SelectContent>
                {filteredPositions.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Candidat (facultatif pour vote blanc)</Label>
            <Input placeholder="Rechercher un candidat..." className="mb-2" value={candidacySearch} onChange={(e) => setCandidacySearch(e.target.value)} disabled={!form.positionId} />
            <Select value={form.candidacyId || "none"} onValueChange={(v) => setForm({ ...form, candidacyId: v === "none" ? null : v })} disabled={!form.positionId}>
              <SelectTrigger>
                <SelectValue placeholder={form.positionId ? "Choisir un candidat (ou laisser vide pour blanc)" : "Choisir d'abord un poste"} />
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

