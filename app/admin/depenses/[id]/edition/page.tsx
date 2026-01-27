"use client";

import { useParams, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { getDepenseById, updateDepense, uploadJustificatif, deleteJustificatif } from "@/actions/depenses";
import { getAllTypesDepense } from "@/actions/depenses/types";
import { toast } from "sonner";
import { Euro, Upload, X, FileText, Image, File, Trash2, Loader2, Receipt } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Justificatif {
  id: string;
  nomFichier: string;
  chemin: string;
  typeMime: string;
  taille: number;
  createdAt: string;
  UploadedBy?: {
    email: string;
  };
}

export default function EditionDepensePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [depense, setDepense] = useState<any>(null);
  const [typesDepense, setTypesDepense] = useState<any[]>([]);
  const [justificatifs, setJustificatifs] = useState<Justificatif[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<{
    libelle: string;
    montant: number;
    dateDepense: string;
    typeDepenseId: string;
    categorie: string;
    description: string;
    statut: "EnAttente" | "Valide" | "Rejete";
  }>({
    libelle: "",
    montant: 0,
    dateDepense: "",
    typeDepenseId: "",
    categorie: "",
    description: "",
    statut: "EnAttente",
  });
  const [initialForm, setInitialForm] = useState(form);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialForm));
  }, [form, initialForm]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [depenseResult, typesResult] = await Promise.all([
        getDepenseById(id),
        getAllTypesDepense()
      ]);

      if (depenseResult.success && depenseResult.data) {
        setDepense(depenseResult.data);
        setJustificatifs(depenseResult.data.Justificatifs || []);
        const init = {
          libelle: depenseResult.data.libelle || "",
          montant: depenseResult.data.montant || 0,
          dateDepense: depenseResult.data.dateDepense || "",
          typeDepenseId: depenseResult.data.typeDepenseId || "",
          categorie: depenseResult.data.categorie || "",
          description: depenseResult.data.description || "",
          statut: depenseResult.data.statut || "EnAttente",
        };
        setForm(init);
        setInitialForm(init);
      }

      if (typesResult.success && typesResult.data) {
        setTypesDepense(typesResult.data.filter((t: any) => t.actif));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!depense) return;
    try {
      const res = await updateDepense({ 
        id, 
        ...form,
        typeDepenseId: form.typeDepenseId || null,
      });
      if (res.success) {
        toast.success("Dépense mise à jour");
        router.back();
      } else {
        toast.error(res.error || "Erreur lors de la mise à jour");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("depenseId", id);

      const result = await uploadJustificatif(formData);
      if (result.success && result.data) {
        return result.data;
      } else {
        toast.error(`Erreur lors de l'upload de ${file.name}: ${result.error}`);
        return null;
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successful = results.filter(r => r !== null);
      
      if (successful.length > 0) {
        toast.success(`${successful.length} fichier(s) uploadé(s) avec succès`);
        await loadData(); // Recharger les données
      }
    } catch (error) {
      console.error("Erreur lors de l'upload:", error);
      toast.error("Erreur lors de l'upload des fichiers");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteJustificatif = async (justificatifId: string) => {
    if (!confirm("Supprimer ce justificatif ?")) return;

    try {
      const result = await deleteJustificatif(justificatifId);
      if (result.success) {
        toast.success("Justificatif supprimé");
        await loadData(); // Recharger les données
      } else {
        toast.error(result.error || "Erreur lors de la suppression");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const getFileIcon = (typeMime: string) => {
    if (typeMime.startsWith("image/")) {
      return <Image className="h-5 w-5 text-blue-500" />;
    } else if (typeMime === "application/pdf") {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  if (loading) {
    return (
      <Modal title="Éditer la dépense" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!depense) {
    return (
      <Modal title="Éditer la dépense" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Dépense introuvable
        </div>
      </Modal>
    );
  }

  const isReadOnly = depense?.statut === "Valide" || depense?.statut === "Rejete";

  return (
    <Modal 
      title="Éditer la dépense" 
      confirmOnClose={isDirty && !isReadOnly}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter={!isReadOnly}
      cancelLabel="Annuler"
      saveLabel="Enregistrer"
      onSave={handleSave}
      onCancel={() => router.back()}
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto">
        {/* Formulaire principal */}
        <Card className="!py-0 border-blue-200 dark:border-blue-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-900/20 dark:to-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Informations de la dépense
              </h3>
              {isReadOnly && (
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700">
                  {depense.statut === "Valide" ? "Validée" : "Rejetée"} - Lecture seule
                </Badge>
              )}
            </div>
            {isReadOnly && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-md border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Cette dépense est {depense.statut === "Valide" ? "validée" : "rejetée"} et ne peut plus être modifiée. Vous pouvez toujours ajouter des justificatifs.
                </p>
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="libelle">Libellé *</Label>
              <Input 
                id="libelle" 
                value={form.libelle} 
                onChange={(e) => setForm({ ...form, libelle: e.target.value })} 
                required 
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="montant">Montant *</Label>
              <div className="relative">
                <Input 
                  id="montant" 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={form.montant} 
                  onChange={(e) => setForm({ ...form, montant: parseFloat(e.target.value) || 0 })} 
                  required 
                  disabled={isReadOnly}
                />
                <Euro className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateDepense">Date *</Label>
              <Input 
                id="dateDepense" 
                type="date" 
                value={form.dateDepense} 
                onChange={(e) => setForm({ ...form, dateDepense: e.target.value })} 
                required 
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="typeDepenseId">Type de dépense</Label>
              <Select 
                value={form.typeDepenseId || "none"} 
                onValueChange={(v) => setForm({ ...form, typeDepenseId: v === "none" ? "" : v })}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="type-none" value="none">Aucun type</SelectItem>
                  {typesDepense.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.titre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categorie">Catégorie (ancien système)</Label>
              <Input 
                id="categorie" 
                value={form.categorie} 
                onChange={(e) => setForm({ ...form, categorie: e.target.value })} 
                placeholder="Catégorie (si pas de type)"
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="statut">Statut</Label>
              <Select 
                value={form.statut} 
                onValueChange={(v) => setForm({ ...form, statut: v as any })}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="statut-enattente" value="EnAttente">En Attente</SelectItem>
                  <SelectItem key="statut-valide" value="Valide">Validé</SelectItem>
                  <SelectItem key="statut-rejete" value="Rejete">Rejeté</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                rows={3} 
                value={form.description} 
                onChange={(e) => setForm({ ...form, description: e.target.value })} 
                placeholder="Description détaillée de la dépense" 
                disabled={isReadOnly}
              />
            </div>
          </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Justificatifs */}
        <Card className="!py-0 border-orange-200 dark:border-orange-800 shadow-sm">
          <CardContent className="p-4 sm:p-6 bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-900/20 dark:to-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                Justificatifs
              </h3>
              <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={uploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Upload...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Ajouter des fichiers
                  </>
                )}
              </Button>
              </div>
            </div>

            <div className="space-y-4">
              {justificatifs.length === 0 ? (
                <Card className="!py-0 border-dashed">
                  <CardContent className="p-6 text-center">
                    <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Aucun justificatif uploadé
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Formats acceptés: PDF, JPG, JPEG, PNG, GIF, WEBP, BMP (max 10MB par fichier)
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {justificatifs.map((justificatif) => (
                    <Card key={justificatif.id} className="!py-0 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {getFileIcon(justificatif.typeMime)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {justificatif.nomFichier}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {formatFileSize(justificatif.taille)}
                                </Badge>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {format(new Date(justificatif.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(justificatif.chemin, '_blank')}
                              className="h-8 w-8 p-0 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/20"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteJustificatif(justificatif.id)}
                              className="h-8 w-8 p-0 border-red-300 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 Vous pouvez sélectionner plusieurs fichiers à la fois. Formats acceptés: PDF, JPG, JPEG, PNG, GIF, WEBP, BMP (max 10MB par fichier)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Modal>
  );
}
