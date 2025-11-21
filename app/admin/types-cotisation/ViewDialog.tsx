"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Eye, 
  Euro, 
  Calendar, 
  User, 
  FileText, 
  CheckCircle2, 
  TrendingUp,
  X,
  Info
} from "lucide-react";

interface TypeCotisationMensuelle {
  id: string;
  nom: string;
  description?: string;
  montant: number;
  actif: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  CreatedBy: {
    id: string;
    email: string;
  };
  _count: {
    CotisationsMensuelles: number;
  };
}

interface ViewDialogProps {
  type: TypeCotisationMensuelle;
}

/**
 * Composant Dialog pour afficher les détails d'un type de cotisation
 * 
 * @param type - Le type de cotisation à afficher
 */
export function ViewDialog({ type }: ViewDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50"
        onClick={() => setOpen(true)}
        title="Voir les détails"
      >
        <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto p-0 gap-0">
          {/* Header avec gradient */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white p-6 rounded-t-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white mb-1">
                    {type.nom}
                  </DialogTitle>
                  <DialogDescription className="text-blue-100 text-sm">
                    Détails du type de cotisation
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="p-6 space-y-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            {/* Statistiques principales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">
                      Montant
                    </p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {type.montant.toFixed(2).replace(".", ",")} €
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <Euro className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>

              <div className="border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50/50 dark:bg-green-900/20 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide mb-1">
                      Utilisations
                    </p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {type._count?.CotisationsMensuelles || 0}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </div>

              <div className={type.actif ? "border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50/50 dark:bg-green-900/20 shadow-sm" : "border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50/50 dark:bg-red-900/20 shadow-sm"}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1">
                      Statut
                    </p>
                    <Badge
                      className={
                        type.actif
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-sm px-3 py-1"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-sm px-3 py-1"
                      }
                    >
                      {type.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  <div className={type.actif ? "h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center" : "h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center"}>
                    <CheckCircle2 className={type.actif ? "h-5 w-5 text-green-600 dark:text-green-400" : "h-5 w-5 text-red-600 dark:text-red-400"} />
                  </div>
                </div>
              </div>
            </div>

            {/* Informations détaillées */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                Informations détaillées
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Description */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                    <FileText className="h-3 w-3" />
                    Description
                  </label>
                  <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm min-h-[60px]">
                    {type.description || (
                      <span className="text-gray-400 dark:text-gray-500 italic">Aucune description</span>
                    )}
                  </div>
                </div>

                {/* Créé par */}
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                    <User className="h-3 w-3" />
                    Créé par
                  </label>
                  <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm">
                    {type.CreatedBy?.email || "-"}
                  </div>
                </div>

                {/* Date de création */}
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                    <Calendar className="h-3 w-3" />
                    Date de création
                  </label>
                  <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                    {new Date(type.createdAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* Date de modification */}
                <div className="space-y-1">
                  <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                    <Calendar className="h-3 w-3" />
                    Dernière modification
                  </label>
                  <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                    {new Date(type.updatedAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 bg-slate-50 dark:bg-gray-800 border-t border-slate-200 dark:border-gray-700 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="bg-white hover:bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-900 shadow-sm"
            >
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

