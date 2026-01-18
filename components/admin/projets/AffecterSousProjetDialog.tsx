"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, UserPlus, Search, Users } from "lucide-react";
import { affecterSousProjet } from "@/actions/projets";
import { getAdherentsLight } from "@/actions/user";
import { toast } from "react-toastify";
import { Input } from "@/components/ui/input";

interface AffecterSousProjetDialogProps {
  sousProjet: {
    id: string;
    titre: string;
    Affectations?: Array<{
      id: string;
      adherentId: string;
      Adherent: {
        id: string;
        firstname: string;
        lastname: string;
      };
    }>;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AffecterSousProjetDialog({ sousProjet, open, onOpenChange, onSuccess }: AffecterSousProjetDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingAdherents, setLoadingAdherents] = useState(true);
  const [adherents, setAdherents] = useState<Array<{ id: string; firstname: string | null; lastname: string | null; email: string | null }>>([]);
  const [selectedAdherents, setSelectedAdherents] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [responsable, setResponsable] = useState(false);
  const initializedKeyRef = useRef<string | null>(null);

  const loadAdherents = useCallback(async () => {
    try {
      setLoadingAdherents(true);
      const result = await getAdherentsLight();
      if (result.success && result.adherents) {
        setAdherents(result.adherents);
      } else {
        toast.error(result.error || "Erreur lors du chargement des adhérents");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des adhérents");
    } finally {
      setLoadingAdherents(false);
    }
  }, []);

  // Réinitialiser quand le dialog se ferme
  useEffect(() => {
    if (!open) {
      initializedKeyRef.current = null;
      setSelectedAdherents(new Set());
      setSearchTerm("");
      setResponsable(false);
      return;
    }

    // Initialiser uniquement une fois quand le dialog s'ouvre avec un nouveau sous-projet
    const currentKey = sousProjet.id;
    if (initializedKeyRef.current === currentKey) {
      return;
    }
    
    initializedKeyRef.current = currentKey;
    
    // Charger les adhérents de manière asynchrone pour éviter les boucles
    Promise.resolve().then(() => {
      loadAdherents();
      
      // Pré-remplir avec les adhérents déjà affectés
      const affectations = sousProjet.Affectations;
      if (affectations && affectations.length > 0) {
        const alreadyAffected = new Set(affectations.map(a => a.adherentId));
        setSelectedAdherents(alreadyAffected);
      } else {
        setSelectedAdherents(new Set());
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sousProjet.id]);

  const filteredAdherents = adherents.filter(adh => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      (adh.firstname?.toLowerCase().includes(search)) ||
      (adh.lastname?.toLowerCase().includes(search)) ||
      (adh.email?.toLowerCase().includes(search))
    );
  });

  const toggleAdherent = useCallback((adherentId: string) => {
    setSelectedAdherents(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(adherentId)) {
        newSelected.delete(adherentId);
      } else {
        newSelected.add(adherentId);
      }
      return newSelected;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedAdherents.size === 0) {
      toast.error("Veuillez sélectionner au moins un adhérent");
      return;
    }

    setLoading(true);

    try {
      const form = new FormData();
      form.append("sousProjetId", sousProjet.id);
      form.append("adherentIds", JSON.stringify(Array.from(selectedAdherents)));
      form.append("responsable", responsable.toString());

      const result = await affecterSousProjet(form);

      if (result.success) {
        toast.success(result.message);
        // Fermer le dialog d'abord
        onOpenChange(false);
        // Attendre un peu avant d'appeler onSuccess pour éviter les conflits
        setTimeout(() => {
          onSuccess?.();
        }, 100);
      } else {
        toast.error(result.error || "Erreur lors de l'affectation");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Une erreur s'est produite");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = useCallback((newOpen: boolean) => {
    onOpenChange(newOpen);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="bg-gradient-to-r from-indigo-500/90 via-indigo-400/80 to-indigo-500/90 dark:from-indigo-700/50 dark:via-indigo-600/40 dark:to-indigo-700/50 text-white px-6 pt-6 pb-4 rounded-t-lg">
          <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-white" />
            Affecter des adhérents à la tâche
          </DialogTitle>
          <DialogDescription className="text-indigo-50 dark:text-indigo-100 text-sm mt-2">
            {sousProjet.titre}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 bg-white dark:bg-gray-900 space-y-4">
          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher un adhérent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Liste des adhérents */}
          {loadingAdherents ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2 space-y-2">
              {filteredAdherents.length > 0 ? (
                filteredAdherents.map((adherent) => {
                  const isSelected = selectedAdherents.has(adherent.id);
                  return (
                    <div
                      key={adherent.id}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleAdherent(adherent.id);
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked !== isSelected) {
                            toggleAdherent(adherent.id);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Label 
                        className="flex-1 cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleAdherent(adherent.id);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-indigo-600" />
                          <span className="font-medium">
                            {adherent.firstname} {adherent.lastname}
                          </span>
                          {adherent.email && (
                            <span className="text-xs text-gray-500">({adherent.email})</span>
                          )}
                        </div>
                      </Label>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  Aucun adhérent trouvé
                </p>
              )}
            </div>
          )}

          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedAdherents.size} adhérent(s) sélectionné(s)
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
              disabled={loading || selectedAdherents.size === 0}
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Affectation...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Affecter ({selectedAdherents.size})
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
