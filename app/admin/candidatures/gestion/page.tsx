"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdherentsLight } from "@/actions/user";
import { getElectionsLightForAdmin, getPositionsForElectionLight, adminCreateCandidacy } from "@/actions/elections";
import { CandidacyStatus } from "@prisma/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function GestionCandidaturesPage() {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [form, setForm] = useState({
    adherentId: "",
    electionId: "",
    positionId: "",
    motivation: "",
    programme: "",
    status: CandidacyStatus.EnAttente as CandidacyStatus,
  });
  const [initialForm] = useState(form);

  // Options
  const [adherentsOptions, setAdherentsOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [electionsOptions, setElectionsOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [positionsOptions, setPositionsOptions] = useState<Array<{ id: string; label: string }>>([]);

  // Recherche
  const [adherentSearch, setAdherentSearch] = useState("");
  const [electionSearch, setElectionSearch] = useState("");
  const [positionSearch, setPositionSearch] = useState("");

  const filteredAdherents = adherentsOptions.filter(o => !adherentSearch.trim() || o.label.toLowerCase().includes(adherentSearch.trim().toLowerCase()));
  const filteredElections = electionsOptions.filter(o => !electionSearch.trim() || o.label.toLowerCase().includes(electionSearch.trim().toLowerCase()));
  const filteredPositions = positionsOptions.filter(o => !positionSearch.trim() || o.label.toLowerCase().includes(positionSearch.trim().toLowerCase()));

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
      }
    })();
  }, [form.electionId]);

  const handleSave = async () => {
    try {
      const res = await adminCreateCandidacy(form);
      if (res.success) {
        toast.success("Candidature créée");
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
      title="Nouvelle candidature" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Créer"
      onSave={handleSave}
      onCancel={() => router.back()}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
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
          <div>
            <Label>Élection</Label>
            <Input placeholder="Rechercher une élection..." className="mb-2" value={electionSearch} onChange={(e) => setElectionSearch(e.target.value)} />
            <Select value={form.electionId} onValueChange={(v) => setForm({ ...form, electionId: v, positionId: "" })}>
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
          <div>
            <Label>Poste</Label>
            <Input placeholder="Rechercher un poste..." className="mb-2" value={positionSearch} onChange={(e) => setPositionSearch(e.target.value)} disabled={!form.electionId} />
            <Select value={form.positionId} onValueChange={(v) => setForm({ ...form, positionId: v })} disabled={!form.electionId}>
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

