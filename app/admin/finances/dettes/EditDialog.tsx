"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X, User, Pencil } from "lucide-react";
import { getDetteInitialeById, updateDetteInitiale } from "@/actions/paiements";
import { toast } from "sonner";
import { AdherentSearchDialog } from "@/components/admin/AdherentSearchDialog";

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
  const [adherentSearchOpen, setAdherentSearchOpen] = useState(false);
  const [selectedAdherent, setSelectedAdherent] = useState<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
  } | null>(null);
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
                    onClick={() => setAdherentSearchOpen(true)}
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
                <AdherentSearchDialog
                  open={adherentSearchOpen}
                  onOpenChange={setAdherentSearchOpen}
                  onSelect={(adherent) => {
                    setSelectedAdherent(adherent);
                    setFormData({ ...formData, adherentId: adherent.id });
                  }}
                />
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
