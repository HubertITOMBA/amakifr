"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X, User, Calendar, Euro, FileText, Eye } from "lucide-react";
import { getDetteInitialeById } from "@/actions/paiements";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ViewDialogProps {
  detteId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactNode;
}

export function ViewDialog({ detteId, open: controlledOpen, onOpenChange, triggerButton }: ViewDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dette, setDette] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
        setDette(res.data);
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
          title="Voir les détails"
        >
          <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto p-0 gap-0">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white p-6 rounded-t-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white mb-1">
                    Dette Initiale
                  </DialogTitle>
                  <DialogDescription className="text-blue-100 text-sm">
                    Détails de la dette
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

          <div className="p-6 space-y-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600 dark:text-red-400">
                {error}
              </div>
            ) : dette ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                      <User className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                      Adhérent
                    </label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                      {dette.Adherent?.firstname} {dette.Adherent?.lastname}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                      <Calendar className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                      Année
                    </label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                      {dette.annee}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                      <Euro className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                      Montant total
                    </label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                      {dette.montant?.toFixed(2)} €
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                      <Euro className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                      Montant payé
                    </label>
                    <div className="p-2 sm:p-2.5 bg-green-50 dark:bg-green-900/20 rounded-md rounded-tl-none border border-green-200 dark:border-green-800 border-t-0 text-xs font-medium text-green-900 dark:text-green-100 font-mono shadow-sm">
                      {dette.montantPaye?.toFixed(2)} €
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                      <Euro className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                      Montant restant
                    </label>
                    <div className={`p-2 sm:p-2.5 rounded-md rounded-tl-none border border-t-0 text-xs font-medium font-mono shadow-sm ${
                      dette.montantRestant > 0 
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100" 
                        : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100"
                    }`}>
                      {dette.montantRestant?.toFixed(2)} €
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                      <Calendar className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                      Date de création
                    </label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                      {format(new Date(dette.createdAt), "d MMM yyyy à HH:mm", { locale: fr })}
                    </div>
                  </div>
                </div>

                {dette.description && (
                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                      <FileText className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                      Description
                    </label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm">
                      {dette.description}
                    </div>
                  </div>
                )}

                {dette.CreatedBy && (
                  <div className="space-y-1">
                    <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-t-md">
                      <User className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                      Créé par
                    </label>
                    <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm">
                      {dette.CreatedBy.name || dette.CreatedBy.email}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          <div className="bg-slate-50 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full bg-slate-50 dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 border-slate-300 dark:border-gray-600 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 text-xs sm:text-sm shadow-sm"
            >
              Retour à la liste
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
