"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileText, Calendar } from "lucide-react";
import { createSousProjet } from "@/actions/projets";
import { toast } from "react-toastify";

interface CreateSousProjetDialogProps {
  projetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateSousProjetDialog({ projetId, open, onOpenChange, onSuccess }: CreateSousProjetDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    statut: "APlanifier",
    ordre: "0",
    dateDebut: "",
    dateFin: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const form = new FormData();
      form.append("projetId", projetId);
      form.append("titre", formData.titre);
      form.append("description", formData.description);
      form.append("statut", formData.statut);
      form.append("ordre", formData.ordre);
      if (formData.dateDebut) form.append("dateDebut", formData.dateDebut);
      if (formData.dateFin) form.append("dateFin", formData.dateFin);

      const result = await createSousProjet(form);

      if (result.success) {
        toast.success(result.message);
        setFormData({
          titre: "",
          description: "",
          statut: "APlanifier",
          ordre: "0",
          dateDebut: "",
          dateFin: "",
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "Erreur lors de la création de la tâche");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Une erreur s'est produite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="bg-gradient-to-r from-purple-500/90 via-purple-400/80 to-purple-500/90 dark:from-purple-700/50 dark:via-purple-600/40 dark:to-purple-700/50 text-white px-6 pt-6 pb-4 rounded-t-lg">
          <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-white" />
            Créer une nouvelle tâche
          </DialogTitle>
          <DialogDescription className="text-purple-50 dark:text-purple-100 text-sm mt-2">
            Ajoutez une nouvelle tâche/sous-projet au projet
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 bg-white dark:bg-gray-900 space-y-4">
          <div>
            <Label htmlFor="titre" className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Titre de la tâche *
            </Label>
            <Input
              id="titre"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              required
              className="mt-1 border-purple-300 dark:border-purple-700"
              placeholder="Ex: Préparation du matériel"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Description *
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={4}
              className="mt-1 border-purple-300 dark:border-purple-700"
              placeholder="Description détaillée de la tâche..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="statut" className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                Statut
              </Label>
              <Select
                value={formData.statut}
                onValueChange={(value) => setFormData({ ...formData, statut: value })}
              >
                <SelectTrigger className="mt-1 border-purple-300 dark:border-purple-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APlanifier">À planifier</SelectItem>
                  <SelectItem value="EnAttente">En attente</SelectItem>
                  <SelectItem value="EnCours">En cours</SelectItem>
                  <SelectItem value="EnPause">En pause</SelectItem>
                  <SelectItem value="Terminee">Terminée</SelectItem>
                  <SelectItem value="Annulee">Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="ordre" className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                Ordre
              </Label>
              <Input
                id="ordre"
                type="number"
                min="0"
                value={formData.ordre}
                onChange={(e) => setFormData({ ...formData, ordre: e.target.value })}
                className="mt-1 border-purple-300 dark:border-purple-700"
              />
            </div>

            <div>
              <Label htmlFor="dateDebut" className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date de début
              </Label>
              <Input
                id="dateDebut"
                type="date"
                value={formData.dateDebut}
                onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                className="mt-1 border-purple-300 dark:border-purple-700"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="dateFin" className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date de fin prévue
            </Label>
            <Input
              id="dateFin"
              type="date"
              value={formData.dateFin}
              onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
              className="mt-1 border-purple-300 dark:border-purple-700"
            />
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto border-gray-300 dark:border-gray-600"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Créer la tâche
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
