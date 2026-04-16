"use client";

import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, X, User, Pencil } from "lucide-react";
import { getDetteInitialeById, updateDetteInitiale } from "@/actions/paiements";
import { toast } from "sonner";
import { getAllUsersForAdmin } from "@/actions/user";

interface EditDialogProps {
  detteId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  triggerButton?: React.ReactNode;
}

export function EditDialog({ detteId, open: controlledOpen, onOpenChange, onSuccess, triggerButton }: EditDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dette, setDette] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAdherent, setSelectedAdherent] = useState<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  } | null>(null);
  const [showAdherentPanel, setShowAdherentPanel] = useState(false);
  const [adherents, setAdherents] = useState<any[]>([]);
  const [loadingAdherents, setLoadingAdherents] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    adherentId: "",
    annee: new Date().getFullYear(),
    montant: "",
    description: "",
  });

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  useEffect(() => {
    if (open && detteId) {
      loadDette();
    }
  }, [open, detteId]);

  useEffect(() => {
    if (!open) {
      setShowAdherentPanel(false);
      setSearchTerm("");
    }
  }, [open]);

  const loadAdherents = async () => {
    try {
      setLoadingAdherents(true);
      const res = await getAllUsersForAdmin();
      if (res.success && res.users) {
        setAdherents(res.users.filter((u: any) => u.adherent));
      } else {
        setAdherents([]);
      }
    } catch (e) {
      console.error(e);
      setAdherents([]);
    } finally {
      setLoadingAdherents(false);
    }
  };

  const filteredAdherents = useMemo(() => {
    const list = adherents;
    if (!searchTerm.trim()) return list.slice(0, 20);
    const query = searchTerm.toLowerCase().trim();
    return list
      .filter((user) => {
        const firstname = user.adherent?.firstname?.toLowerCase() || "";
        const lastname = user.adherent?.lastname?.toLowerCase() || "";
        const email = user.email?.toLowerCase() || "";
        const fullName = `${firstname} ${lastname}`.toLowerCase();
        return firstname.includes(query) || lastname.includes(query) || email.includes(query) || fullName.includes(query);
      })
      .slice(0, 50);
  }, [adherents, searchTerm]);

  const loadDette = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDetteInitialeById(detteId);
      if (res.success && res.data) {
        const d = res.data;
        setDette(d);
        setFormData({
          adherentId: d.adherentId,
          annee: d.annee,
          montant: d.montant.toString(),
          description: d.description || "",
        });
        if (d.Adherent) {
          setSelectedAdherent({
            id: d.Adherent.id,
            firstname: d.Adherent.firstname,
            lastname: d.Adherent.lastname,
            email: d.Adherent.User?.email || "",
          });
        }
      } else {
        setError(res.error || "Erreur lors du chargement");
      }
    } catch (e) {
      console.error(e);
      setError("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.adherentId || !formData.montant) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      setSaving(true);
      const result = await updateDetteInitiale({
        id: detteId,
        adherentId: formData.adherentId,
        annee: formData.annee,
        montant: parseFloat(formData.montant),
        description: formData.description || undefined,
      });

      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {triggerButton ? (
        <div onClick={() => setOpen(true)}>{triggerButton}</div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50"
          onClick={() => setOpen(true)}
          title="Modifier"
        >
          <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier une dette initiale</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la dette initiale
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600 dark:text-red-400">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-adherent">Adhérent *</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      setShowAdherentPanel((v) => !v);
                      if (adherents.length === 0) {
                        await loadAdherents();
                      }
                    }}
                    className="flex-1 justify-start"
                  >
                    <User className="h-4 w-4 mr-2" />
                    {selectedAdherent
                      ? `${selectedAdherent.firstname} ${selectedAdherent.lastname}`
                      : "Rechercher un adhérent"}
                  </Button>
                  {selectedAdherent && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAdherent(null);
                        setFormData({ ...formData, adherentId: "" });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {selectedAdherent && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {selectedAdherent.email}
                  </p>
                )}

                {/* Recherche inline (évite dialog imbriqué) */}
                {showAdherentPanel && (
                  <div className="mt-3 rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10 p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Rechercher par nom, prénom ou email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-white dark:bg-gray-900"
                        autoFocus
                      />
                      {searchTerm && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => setSearchTerm("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900">
                      {loadingAdherents ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        </div>
                      ) : filteredAdherents.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                          {searchTerm ? "Aucun adhérent trouvé" : "Commencez à taper pour rechercher"}
                        </div>
                      ) : (
                        <div className="divide-y">
                          {filteredAdherents.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                const adherent = {
                                  id: user.adherent.id,
                                  firstname: user.adherent.firstname,
                                  lastname: user.adherent.lastname,
                                  email: user.email,
                                };
                                setSelectedAdherent(adherent);
                                setFormData({ ...formData, adherentId: adherent.id });
                                setShowAdherentPanel(false);
                                setSearchTerm("");
                              }}
                              className="w-full p-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3"
                            >
                              <div className="flex-shrink-0">
                                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">
                                  {user.adherent?.firstname} {user.adherent?.lastname}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                  {user.email}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {!loadingAdherents && filteredAdherents.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                        {filteredAdherents.length} adhérent(s) trouvé(s)
                        {searchTerm && adherents.length > filteredAdherents.length && <span> sur {adherents.length}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="edit-annee">Année *</Label>
                <Input
                  id="edit-annee"
                  type="number"
                  min="2020"
                  max="2100"
                  value={formData.annee}
                  onChange={(e) => setFormData({ ...formData, annee: parseInt(e.target.value) || new Date().getFullYear() })}
                />
              </div>
              <div>
                <Label htmlFor="edit-montant">Montant (€) *</Label>
                <Input
                  id="edit-montant"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.montant}
                  onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description optionnelle"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Annuler
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
