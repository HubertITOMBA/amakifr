"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { getAllPostesTemplates } from "@/actions/postes";
import { createElection, getElectionById, updateElection, addPositionsToElection, createCustomPosition, updatePosition, deletePosition } from "@/actions/elections";
import { PositionType } from "@prisma/client";

interface PosteTemplate {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  ordre: number;
  actif: boolean;
}

export default function ElectionForm({ electionId, hideActions, onDirtyChange }: { electionId?: string; hideActions?: boolean; onDirtyChange?: (dirty: boolean) => void; }) {
  const isEdit = !!electionId;
  const [postesTemplates, setPostesTemplates] = useState<PosteTemplate[]>([]);
  const [selectedPostes, setSelectedPostes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [positions, setPositions] = useState<any[]>([]);
  const [initialForm, setInitialForm] = useState<typeof electionForm | null>(null);
  const [showCustomPositionForm, setShowCustomPositionForm] = useState(false);
  const [customPositionForm, setCustomPositionForm] = useState({
    titre: "",
    description: "",
    nombreMandats: 1,
    dureeMandat: 24,
    conditions: "Être membre actif de l'association",
  });

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Marquer sale à la première modification
  const markDirty = () => setDirty(true);

  const [electionForm, setElectionForm] = useState({
    titre: "",
    description: "",
    dateOuverture: "",
    dateCloture: "",
    dateClotureCandidature: "",
    dateScrutin: "",
    nombreMandats: 1,
    quorumRequis: 0,
    majoriteRequis: "Absolue",
  });

  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    loadPostes();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setInitialLoading(true);
        const res = await getElectionById(electionId!);
        if (res.success && res.election) {
          const e = res.election;
          setElectionForm({
            titre: e.titre || "",
            description: e.description || "",
            dateOuverture: e.dateOuverture ? new Date(e.dateOuverture).toISOString().slice(0, 16) : "",
            dateCloture: e.dateCloture ? new Date(e.dateCloture).toISOString().slice(0, 16) : "",
            dateClotureCandidature: e.dateClotureCandidature ? new Date(e.dateClotureCandidature).toISOString().slice(0, 16) : "",
            dateScrutin: e.dateScrutin ? new Date(e.dateScrutin).toISOString().slice(0, 16) : "",
            nombreMandats: e.nombreMandats || 1,
            quorumRequis: e.quorumRequis || 0,
            majoriteRequis: e.majoriteRequis || "Absolue",
          });
          setInitialForm({
            titre: e.titre || "",
            description: e.description || "",
            dateOuverture: e.dateOuverture ? new Date(e.dateOuverture).toISOString().slice(0, 16) : "",
            dateCloture: e.dateCloture ? new Date(e.dateCloture).toISOString().slice(0, 16) : "",
            dateClotureCandidature: e.dateClotureCandidature ? new Date(e.dateClotureCandidature).toISOString().slice(0, 16) : "",
            dateScrutin: e.dateScrutin ? new Date(e.dateScrutin).toISOString().slice(0, 16) : "",
            nombreMandats: e.nombreMandats || 1,
            quorumRequis: e.quorumRequis || 0,
            majoriteRequis: e.majoriteRequis || "Absolue",
          });
          setPositions(e.positions || []);
        }
      } finally {
        setInitialLoading(false);
      }
    })();
  }, [isEdit, electionId]);

  const loadPostes = async () => {
    try {
      const result = await getAllPostesTemplates(true);
      if (result.success && result.data) {
        setPostesTemplates(result.data as PosteTemplate[]);
      }
    } catch (e) {
      console.error("Erreur lors du chargement des postes", e);
    }
  };

  useEffect(() => {
    const onModalSave = () => {
      if (formRef.current) formRef.current.requestSubmit();
    };
    window.addEventListener("modal-save", onModalSave as EventListener);
    return () => window.removeEventListener("modal-save", onModalSave as EventListener);
  }, []);

  const togglePoste = (posteId: string) => {
    setSelectedPostes((prev) =>
      prev.includes(posteId) ? prev.filter((p) => p !== posteId) : [...prev, posteId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (isEdit) {
        // Contrôle: aucune modification détectée
        if (initialForm &&
          initialForm.titre === electionForm.titre &&
          initialForm.description === electionForm.description &&
          initialForm.dateOuverture === electionForm.dateOuverture &&
          initialForm.dateCloture === electionForm.dateCloture &&
          initialForm.dateClotureCandidature === electionForm.dateClotureCandidature &&
          initialForm.dateScrutin === electionForm.dateScrutin &&
          initialForm.nombreMandats === electionForm.nombreMandats &&
          initialForm.quorumRequis === electionForm.quorumRequis &&
          initialForm.majoriteRequis === electionForm.majoriteRequis
        ) {
          alert("Aucune modification détectée");
          return;
        }
        // Validation côté client des dates
        if (!electionForm.dateClotureCandidature) {
          alert("La date de clôture des candidatures est obligatoire");
          return;
        }

        const dateOuverture = new Date(electionForm.dateOuverture);
        const dateClotureCandidature = new Date(electionForm.dateClotureCandidature);
        const dateScrutin = new Date(electionForm.dateScrutin);
        const dateCloture = new Date(electionForm.dateCloture);

        if (dateOuverture >= dateClotureCandidature) {
          alert("La date d'ouverture doit être antérieure à la date de clôture des candidatures");
          return;
        }

        if (dateClotureCandidature >= dateScrutin) {
          alert("La date de clôture des candidatures doit être antérieure à la date du scrutin");
          return;
        }

        if (dateCloture <= dateScrutin) {
          alert("La date de clôture doit être postérieure à la date du scrutin");
          return;
        }

        const res = await updateElection(electionId!, {
          titre: electionForm.titre,
          description: electionForm.description,
          dateOuverture: new Date(electionForm.dateOuverture),
          dateCloture: new Date(electionForm.dateCloture),
          dateClotureCandidature: new Date(electionForm.dateClotureCandidature),
          dateScrutin: new Date(electionForm.dateScrutin),
          nombreMandats: electionForm.nombreMandats,
          quorumRequis: electionForm.quorumRequis,
          majoriteRequis: electionForm.majoriteRequis,
        });
        if (!res.success) {
          alert(res.error || "Erreur lors de la mise à jour de l'élection");
          return;
        }
        alert("Élection mise à jour avec succès !");
      } else {
        if (selectedPostes.length === 0) {
          alert("Veuillez sélectionner au moins un poste pour créer l'élection");
          return;
        }

        // Validation côté client des dates
        if (!electionForm.dateClotureCandidature) {
          alert("La date de clôture des candidatures est obligatoire");
          return;
        }

        const dateOuverture = new Date(electionForm.dateOuverture);
        const dateClotureCandidature = new Date(electionForm.dateClotureCandidature);
        const dateScrutin = new Date(electionForm.dateScrutin);
        const dateCloture = new Date(electionForm.dateCloture);

        if (dateOuverture >= dateClotureCandidature) {
          alert("La date d'ouverture doit être antérieure à la date de clôture des candidatures");
          return;
        }

        if (dateClotureCandidature >= dateScrutin) {
          alert("La date de clôture des candidatures doit être antérieure à la date du scrutin");
          return;
        }

        if (dateCloture <= dateScrutin) {
          alert("La date de clôture doit être postérieure à la date du scrutin");
          return;
        }

        const res = await createElection(
          {
            titre: electionForm.titre,
            description: electionForm.description,
            dateOuverture: new Date(electionForm.dateOuverture),
            dateCloture: new Date(electionForm.dateCloture),
            dateClotureCandidature: new Date(electionForm.dateClotureCandidature),
            dateScrutin: new Date(electionForm.dateScrutin),
            nombreMandats: electionForm.nombreMandats,
            quorumRequis: electionForm.quorumRequis,
            majoriteRequis: electionForm.majoriteRequis,
          },
          selectedPostes
        );
        if (!res.success) {
          alert(res.error || "Erreur lors de la création de l'élection");
          return;
        }
        alert("Élection créée avec succès !");
      }
    } catch (err) {
      console.error(err);
      alert(isEdit ? "Erreur lors de la mise à jour de l'élection" : "Erreur lors de la création de l'élection");
    } finally {
      setLoading(false);
    }
  };

  const codeToTypeMap: Record<string, PositionType> = {
    // Nouveaux codes (6 caractères)
    'PRESID': PositionType.President,
    'VICEPR': PositionType.VicePresident,
    'SECRET': PositionType.Secretaire,
    'VICESE': PositionType.ViceSecretaire,
    'TRESOR': PositionType.Tresorier,
    'VICETR': PositionType.ViceTresorier,
    'COMCPT': PositionType.CommissaireComptes,
    'MEMCDI': PositionType.MembreComiteDirecteur,
    // Anciens codes (pour rétrocompatibilité)
    'president': PositionType.President,
    'vice_president': PositionType.VicePresident,
    'secretaire': PositionType.Secretaire,
    'vice_secretaire': PositionType.ViceSecretaire,
    'tresorier': PositionType.Tresorier,
    'vice_tresorier': PositionType.ViceTresorier,
    'commissaire_comptes': PositionType.CommissaireComptes,
    'membre_comite_directeur': PositionType.MembreComiteDirecteur,
  };

  const reloadElection = async () => {
    if (!isEdit) return;
    const res = await getElectionById(electionId!);
    if (res.success && res.election) setPositions(res.election.positions || []);
  }

  const handleAddSelectedTemplates = async () => {
    if (!isEdit) return;
    // Empêcher les doublons: ignorer les templates déjà présents
    const existingTemplateIds = new Set(positions.map((p: any) => p.posteTemplateId).filter(Boolean));
    const selectedTemplates = postesTemplates.filter(t => selectedPostes.includes(t.id));
    const newTemplates = selectedTemplates.filter(t => !existingTemplateIds.has(t.id));
    const skipped = selectedTemplates.filter(t => existingTemplateIds.has(t.id));

    if (newTemplates.length === 0) {
      alert("Les postes sélectionnés existent déjà dans cette élection");
      return;
    }

    const positionsData = newTemplates.map(t => ({
      type: codeToTypeMap[t.code.toUpperCase()] || codeToTypeMap[t.code] || PositionType.MembreComiteDirecteur,
      titre: t.libelle,
      description: t.description || `Poste de ${t.libelle.toLowerCase()}`,
      nombreMandats: (t as any).nombreMandatsDefaut || 1,
      dureeMandat: (t as any).dureeMandatDefaut || 24,
      conditions: "Être membre actif de l'association",
    }));
    const res = await addPositionsToElection(electionId!, positionsData as any);
    if (!res.success) {
      alert(res.error || "Erreur lors de l'ajout des postes");
      return;
    }
    setSelectedPostes([]);
    if (skipped.length > 0) {
      alert(`${skipped.length} poste(s) ignoré(s) car déjà présent(s).`);
    }
    await reloadElection();
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEdit) return;
    // Contrôle doublon de titre (insensible à la casse/espaces)
    const newTitle = customPositionForm.titre.trim().toLowerCase();
    if (!newTitle) {
      alert("Veuillez saisir un titre de poste");
      return;
    }
    const hasDuplicateTitle = positions.some((p: any) => (p.titre || "").trim().toLowerCase() === newTitle);
    if (hasDuplicateTitle) {
      alert("Un poste avec ce titre existe déjà pour cette élection");
      return;
    }
    const res = await createCustomPosition(electionId!, { type: PositionType.MembreComiteDirecteur, ...customPositionForm });
    if (!res.success) {
      alert(res.error || "Erreur lors de l'ajout du poste");
      return;
    }
    setShowCustomPositionForm(false);
    setCustomPositionForm({ titre: "", description: "", nombreMandats: 1, dureeMandat: 24, conditions: "Être membre actif de l'association" });
    await reloadElection();
  };

  const handleUpdatePosition = async (pos: any, patch: any) => {
    if (!patch || Object.keys(patch).length === 0) {
      alert("Aucune modification à enregistrer pour ce poste");
      return;
    }
    const res = await updatePosition(pos.id, patch);
    if (!res.success) {
      alert(res.error || "Erreur lors de la mise à jour du poste");
      return;
    }
    await reloadElection();
  };

  const handleDeletePosition = async (pos: any) => {
    if (!confirm(`Supprimer le poste "${pos.titre}" ?`)) return;
    const res = await deletePosition(pos.id);
    if (!res.success) {
      alert(res.error || "Erreur lors de la suppression du poste");
      return;
    }
    await reloadElection();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? "Modifier l'élection" : "Créer une nouvelle élection"}</CardTitle>
        <CardDescription>
          {isEdit ? "Mettez à jour les informations de l'élection" : "Configurez l'élection et sélectionnez les postes"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="titre" className="flex items-center gap-1">
                Titre de l'élection <span className="text-red-500">*</span>
              </Label>
              <Input
                id="titre"
                value={electionForm.titre}
                onChange={(e) => { setElectionForm({ ...electionForm, titre: e.target.value }); markDirty(); }}
                placeholder="Ex: Élection du comité directeur 2024"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={electionForm.description}
                onChange={(e) => { setElectionForm({ ...electionForm, description: e.target.value }); markDirty(); }}
                placeholder="Description de l'élection..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="dateOuverture" className="flex items-center gap-1">
                Date d'ouverture <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dateOuverture"
                type="datetime-local"
                value={electionForm.dateOuverture}
                onChange={(e) => { setElectionForm({ ...electionForm, dateOuverture: e.target.value }); markDirty(); }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateCloture" className="flex items-center gap-1">
                Date de clôture <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dateCloture"
                type="datetime-local"
                value={electionForm.dateCloture}
                onChange={(e) => { setElectionForm({ ...electionForm, dateCloture: e.target.value }); markDirty(); }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateClotureCandidature" className="flex items-center gap-1">
                Date de clôture des candidatures <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dateClotureCandidature"
                type="datetime-local"
                value={electionForm.dateClotureCandidature}
                onChange={(e) => { setElectionForm({ ...electionForm, dateClotureCandidature: e.target.value }); markDirty(); }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateScrutin" className="flex items-center gap-1">
                Date du scrutin <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dateScrutin"
                type="datetime-local"
                value={electionForm.dateScrutin}
                onChange={(e) => { setElectionForm({ ...electionForm, dateScrutin: e.target.value }); markDirty(); }}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="nombreMandats">Nombre de mandats</Label>
              <Input
                id="nombreMandats"
                type="number"
                min="1"
                value={electionForm.nombreMandats}
                onChange={(e) => { setElectionForm({ ...electionForm, nombreMandats: parseInt(e.target.value) }); markDirty(); }}
              />
            </div>
            <div>
              <Label htmlFor="quorumRequis">Quorum requis (%)</Label>
              <Input
                id="quorumRequis"
                type="number"
                min="0"
                max="100"
                value={electionForm.quorumRequis}
                onChange={(e) => { setElectionForm({ ...electionForm, quorumRequis: parseInt(e.target.value) }); markDirty(); }}
              />
            </div>
            <div>
              <Label htmlFor="majoriteRequis">Majorité requise</Label>
              <Select
                value={electionForm.majoriteRequis}
                onValueChange={(value) => { setElectionForm({ ...electionForm, majoriteRequis: value }); markDirty(); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Absolue">Absolue</SelectItem>
                  <SelectItem value="Relative">Relative</SelectItem>
                  <SelectItem value="Qualifiée">Qualifiée</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (
            <div>
              <Label className="text-base font-semibold">Postes à pourvoir</Label>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 mb-4">
                Sélectionnez les postes qui seront ouverts aux candidatures et aux votes
              </p>
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Postes sélectionnés: {selectedPostes.length}/{postesTemplates.length}
                  </span>
                  {selectedPostes.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelectedPostes([])} className="text-xs">
                      Tout désélectionner
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {postesTemplates.length > 0 ? (
                  postesTemplates
                    .sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle))
                    .map((poste) => (
                      <div
                        key={poste.id}
                        className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                          selectedPostes.includes(poste.id)
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                        onClick={() => togglePoste(poste.id)}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={poste.id}
                            checked={selectedPostes.includes(poste.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              togglePoste(poste.id);
                            }}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor={poste.id} className="text-sm font-medium cursor-pointer flex-1">
                            {poste.libelle}
                            {poste.description && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                                {poste.description}
                              </span>
                            )}
                          </Label>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    Aucun poste disponible. Veuillez créer des postes depuis la page de gestion des postes.
                  </div>
                )}
              </div>

              {selectedPostes.length === 0 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 text-amber-600 mr-2" />
                    <span className="text-sm text-amber-800 dark:text-amber-200">
                      Veuillez sélectionner au moins un poste pour créer l'élection
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {isEdit && (
            <div className="space-y-6">
              <div>
                <div className="text-base font-semibold mb-2">Postes existants</div>
                <div className="space-y-3">
                  {positions.length > 0 ? positions.map((p) => (
                    <div key={p.id} className="p-3 border rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div className="space-y-2">
                          <Label>Titre</Label>
                          <Input defaultValue={p.titre} onBlur={(e) => e.target.value !== p.titre && handleUpdatePosition(p, { titre: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nombre de mandats</Label>
                          <Input type="number" min={1} defaultValue={p.nombreMandats || 1} onBlur={(e) => Number(e.target.value) !== (p.nombreMandats||1) && handleUpdatePosition(p, { nombreMandats: Number(e.target.value) })} />
                        </div>
                        <div className="md:col-span-1 flex gap-2">
                          <Button type="button" variant="outline" onClick={() => handleUpdatePosition(p, { })}>Sauver</Button>
                          <Button type="button" variant="destructive" onClick={() => handleDeletePosition(p)}>Supprimer</Button>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="text-sm text-gray-500">Aucun poste pour cette élection.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-base font-semibold mb-2">Ajouter des postes depuis les templates</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {postesTemplates.map((t) => {
                    const exists = positions.some((p) => p.posteTemplateId === t.id);
                    return (
                      <label key={t.id} className={`p-3 border rounded-lg cursor-pointer ${selectedPostes.includes(t.id) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'} ${exists ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" disabled={exists} checked={selectedPostes.includes(t.id)} onChange={(e) => {
                            if (exists) return;
                            setSelectedPostes((prev) => e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id));
                          }} />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{t.libelle} {exists && <span className="text-xs text-amber-600">(déjà ajouté)</span>}</div>
                            {t.description && (<div className="text-xs text-gray-500">{t.description}</div>)}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-end mt-3">
                  <Button type="button" onClick={handleAddSelectedTemplates} disabled={selectedPostes.length===0}>Ajouter les postes sélectionnés</Button>
                </div>
              </div>

              <div>
                <div className="text-base font-semibold mb-2">Ajouter un poste personnalisé</div>
                {!showCustomPositionForm ? (
                  <Button type="button" variant="outline" onClick={() => setShowCustomPositionForm(true)}>Ajouter un poste personnalisé</Button>
                ) : (
                  <form onSubmit={handleCreateCustom} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Titre</Label>
                      <Input value={customPositionForm.titre} onChange={(e) => setCustomPositionForm({ ...customPositionForm, titre: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre de mandats</Label>
                      <Input type="number" min={1} value={customPositionForm.nombreMandats} onChange={(e) => setCustomPositionForm({ ...customPositionForm, nombreMandats: Number(e.target.value) })} />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Description</Label>
                      <Textarea value={customPositionForm.description} onChange={(e) => setCustomPositionForm({ ...customPositionForm, description: e.target.value })} rows={2} />
                    </div>
                    <div className="space-y-2">
                      <Label>Durée (mois)</Label>
                      <Input type="number" min={1} value={customPositionForm.dureeMandat} onChange={(e) => setCustomPositionForm({ ...customPositionForm, dureeMandat: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Conditions</Label>
                      <Textarea rows={2} value={customPositionForm.conditions} onChange={(e) => setCustomPositionForm({ ...customPositionForm, conditions: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowCustomPositionForm(false)}>Annuler</Button>
                      <Button type="submit">Ajouter</Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {!hideActions && (
            <div className="flex justify-end">
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? (isEdit ? "Enregistrement..." : "Création...") : (isEdit ? "Enregistrer les modifications" : "Créer l'élection")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
