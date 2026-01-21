"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Edit } from "lucide-react";
import { updateDocument, adminUpdateDocument } from "@/actions/documents";
import { toast } from "sonner";

interface EditDocumentDialogProps {
  document: {
    id: string;
    nomOriginal: string;
    categorie?: string | null;
    description?: string | null;
    estPublic?: boolean;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSuccess?: () => void;
  isAdmin?: boolean;
}

export function EditDocumentDialog({
  document,
  open,
  onOpenChange,
  onUpdateSuccess,
  isAdmin = false,
}: EditDocumentDialogProps) {
  const [categorie, setCategorie] = useState(document.categorie || "");
  const [description, setDescription] = useState(document.description || "");
  const [estPublic, setEstPublic] = useState(document.estPublic || false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCategorie(document.categorie || "");
      setDescription(document.description || "");
      setEstPublic(document.estPublic || false);
    }
  }, [open, document]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const result = isAdmin
        ? await adminUpdateDocument(document.id, {
            categorie: categorie || undefined,
            description: description || undefined,
            estPublic,
          })
        : await updateDocument(document.id, {
            categorie: categorie || undefined,
            description: description || undefined,
            estPublic,
          });

      if (result.success) {
        toast.success(result.message || "Document mis à jour avec succès");
        onOpenChange(false);
        if (onUpdateSuccess) {
          onUpdateSuccess();
        }
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour du document");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Modifier le document
          </DialogTitle>
          <DialogDescription>
            Modifiez les informations du document : {document.nomOriginal}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="categorie">Catégorie</Label>
            <Input
              id="categorie"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              placeholder="Ex: Factures, Contrats, etc."
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du document..."
              rows={4}
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="estPublic"
              checked={estPublic}
              onChange={(e) => setEstPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="estPublic" className="cursor-pointer">
              Rendre ce document public (visible par les administrateurs)
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
