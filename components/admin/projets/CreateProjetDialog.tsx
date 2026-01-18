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
import { Loader2, FolderKanban, Calendar, FileText } from "lucide-react";
import { createProjet } from "@/actions/projets";
import { toast } from "react-toastify";

interface CreateProjetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateProjetDialog({ open, onOpenChange, onSuccess }: CreateProjetDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    statut: "Planifie",
    dateDebut: "",
    dateFin: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const form = new FormData();
      form.append("titre", formData.titre);
      form.append("description", formData.description);
      form.append("statut", formData.statut);
      if (formData.dateDebut) form.append("dateDebut", formData.dateDebut);
      if (formData.dateFin) form.append("dateFin", formData.dateFin);

      const result = await createProjet(form);

      if (result.success) {
        toast.success(result.message);
        setFormData({
          titre: "",
          description: "",
          statut: "Planifie",
          dateDebut: "",
          dateFin: "",
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "Erreur lors de la création du projet");
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
        <DialogHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white px-6 pt-6 pb-4 rounded-t-lg">
          <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-white" />
            Créer un nouveau projet
          </DialogTitle>
          <DialogDescription className="text-blue-50 dark:text-blue-100 text-sm mt-2">
            Créez un nouveau projet avec ses sous-projets et affectations
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 bg-white dark:bg-gray-900 space-y-4">
          <div>
            <Label htmlFor="titre" className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              Titre du projet *
            </Label>
            <Input
              id="titre"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              required
              className="mt-1 border-blue-300 dark:border-blue-700"
              placeholder="Ex: Organisation de l'événement annuel"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Description *
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={4}
              className="mt-1 border-blue-300 dark:border-blue-700"
              placeholder="Description détaillée du projet..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="statut" className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                Statut
              </Label>
              <Select
                value={formData.statut}
                onValueChange={(value) => setFormData({ ...formData, statut: value })}
              >
                <SelectTrigger className="mt-1 border-blue-300 dark:border-blue-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planifie">Planifié</SelectItem>
                  <SelectItem value="EnCours">En cours</SelectItem>
                  <SelectItem value="EnPause">En pause</SelectItem>
                  <SelectItem value="Termine">Terminé</SelectItem>
                  <SelectItem value="Annule">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dateDebut" className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date de début
              </Label>
              <Input
                id="dateDebut"
                type="date"
                value={formData.dateDebut}
                onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                className="mt-1 border-blue-300 dark:border-blue-700"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="dateFin" className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Date de fin prévue
            </Label>
            <Input
              id="dateFin"
              type="date"
              value={formData.dateFin}
              onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
              className="mt-1 border-blue-300 dark:border-blue-700"
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
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Créer le projet
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
