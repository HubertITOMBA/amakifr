"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  X,
  FileText,
  Euro,
  Settings,
  CheckCircle2,
  Info,
  Users,
  ListOrdered,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import { createTypeCotisationMensuelle } from "@/actions/cotisations-mensuelles";

export type CategorieTypeCotisation = "ForfaitMensuel" | "Assistance" | "Divers";

const labelClass =
  "text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md dark:bg-slate-800 dark:text-slate-200";
const inputClass =
  "rounded-md rounded-tl-none border border-slate-200 dark:border-slate-600 border-t-0 focus:border-blue-400 focus:ring-blue-400 dark:bg-slate-900 dark:text-slate-100";

interface CreateTypeCotisationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const defaultFormData = {
  nom: "",
  description: "",
  montant: 0,
  obligatoire: true,
  actif: true,
  ordre: 0,
  categorie: "Divers" as CategorieTypeCotisation,
  aBeneficiaire: false,
};

export function CreateTypeCotisationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateTypeCotisationDialogProps) {
  const [formData, setFormData] = useState(defaultFormData);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createTypeCotisationMensuelle({
        nom: formData.nom.trim(),
        description: formData.description.trim() || undefined,
        montant: formData.montant,
        obligatoire: formData.obligatoire,
        actif: formData.actif,
        ordre: formData.ordre,
        categorie: formData.categorie,
        aBeneficiaire: formData.aBeneficiaire,
      });

      if (result.success) {
        toast.success("Type de cotisation créé");
        setFormData(defaultFormData);
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setFormData(defaultFormData);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto p-0 gap-0 border-slate-200 dark:border-slate-700">
        {/* Header avec gradient (style professionnel) */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white p-6 rounded-t-lg shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white mb-1">
                  Nouveau type de cotisation
                </DialogTitle>
                <DialogDescription className="text-blue-100 text-sm">
                  Créer un type de cotisation mensuelle (forfait, assistance ou divers)
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Informations du type
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nom */}
              <div className="space-y-1 md:col-span-2">
                <label className={labelClass}>
                  <FileText className="h-3 w-3" />
                  Nom *
                </label>
                <Input
                  id="create-type-nom"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  placeholder="ex: Forfait Mensuel, Décès, Naissance"
                  required
                  className={inputClass}
                />
              </div>

              {/* Montant */}
              <div className="space-y-1">
                <label className={labelClass}>
                  <Euro className="h-3 w-3" />
                  Montant * (€)
                </label>
                <div className="relative">
                  <Input
                    id="create-type-montant"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.montant || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, montant: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0.00"
                    required
                    className={`${inputClass} pr-10`}
                  />
                  <Euro className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* Ordre */}
              <div className="space-y-1">
                <label className={labelClass}>
                  <ListOrdered className="h-3 w-3" />
                  Ordre d&apos;affichage
                </label>
                <Input
                  id="create-type-ordre"
                  type="number"
                  min="0"
                  value={formData.ordre}
                  onChange={(e) =>
                    setFormData({ ...formData, ordre: parseInt(e.target.value, 10) || 0 })
                  }
                  className={inputClass}
                />
              </div>

              {/* Catégorie */}
              <div className="space-y-1">
                <label className={labelClass}>
                  <Settings className="h-3 w-3" />
                  Catégorie
                </label>
                <Select
                  value={formData.categorie}
                  onValueChange={(v: CategorieTypeCotisation) =>
                    setFormData({ ...formData, categorie: v })
                  }
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Choisir une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ForfaitMensuel">Forfait mensuel</SelectItem>
                    <SelectItem value="Assistance">Assistance</SelectItem>
                    <SelectItem value="Divers">Divers / Extra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Obligatoire */}
              <div className="space-y-1">
                <label className={labelClass}>
                  <CheckCircle2 className="h-3 w-3" />
                  Obligatoire
                </label>
                <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-slate-200 dark:border-slate-600 border-t-0 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="create-type-obligatoire"
                      checked={formData.obligatoire}
                      onChange={(e) =>
                        setFormData({ ...formData, obligatoire: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <Label
                      htmlFor="create-type-obligatoire"
                      className="cursor-pointer text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                      Cotisation obligatoire
                    </Label>
                  </div>
                </div>
              </div>

              {/* À bénéficiaire (assistance) */}
              <div className="space-y-1">
                <label className={labelClass}>
                  <Users className="h-3 w-3" />
                  Avec bénéficiaire
                </label>
                <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-slate-200 dark:border-slate-600 border-t-0 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="create-type-aBeneficiaire"
                      checked={formData.aBeneficiaire}
                      onChange={(e) =>
                        setFormData({ ...formData, aBeneficiaire: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <Label
                      htmlFor="create-type-aBeneficiaire"
                      className="cursor-pointer text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                      Type assistance (un adhérent bénéficiaire ne paie pas)
                    </Label>
                  </div>
                </div>
              </div>

              {/* Actif */}
              <div className="space-y-1 md:col-span-2">
                <label className={labelClass}>
                  <CheckCircle2 className="h-3 w-3" />
                  Statut
                </label>
                <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-slate-200 dark:border-slate-600 border-t-0 shadow-sm">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="create-type-actif"
                      checked={formData.actif}
                      onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <Label
                      htmlFor="create-type-actif"
                      className="cursor-pointer text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                      Type actif
                    </Label>
                    <Badge
                      className={
                        formData.actif
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs ml-auto"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs ml-auto"
                      }
                    >
                      {formData.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1 md:col-span-2">
                <label className={labelClass}>
                  <FileText className="h-3 w-3" />
                  Description
                </label>
                <Textarea
                  id="create-type-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description optionnelle du type de cotisation"
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900 text-xs sm:text-sm shadow-sm"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer le type
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
