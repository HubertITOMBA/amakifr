"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { affecterSousProjet } from "@/actions/projets";
import { getAdherentsLight } from "@/actions/user";
import { Loader2, Search, UserPlus, Users } from "lucide-react";
import { toast } from "react-toastify";

export interface InlineAffectationPanelProps {
  sousProjet: {
    id: string;
    titre: string;
    Affectations?: Array<{
      id: string;
      adherentId: string;
      responsable?: boolean;
      Adherent: {
        id: string;
        firstname: string;
        lastname: string;
      };
    }>;
  };
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Panneau inline d'affectation (sans dialog) pour éviter les soucis Radix imbriqués.
 */
export function InlineAffectationPanel({ sousProjet, open, onClose, onSuccess }: InlineAffectationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [loadingAdherents, setLoadingAdherents] = useState(false);
  const [adherents, setAdherents] = useState<
    Array<{ id: string; firstname: string | null; lastname: string | null; email: string | null }>
  >([]);
  const [selectedAdherents, setSelectedAdherents] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
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

  useEffect(() => {
    if (!open) return;

    const currentKey = sousProjet.id;
    if (initializedKeyRef.current === currentKey) return;
    initializedKeyRef.current = currentKey;

    loadAdherents();
    const affectations = sousProjet.Affectations;
    if (affectations?.length) {
      setSelectedAdherents(new Set(affectations.map((a) => a.adherentId)));
    } else {
      setSelectedAdherents(new Set());
    }
    setSearchTerm("");
  }, [open, sousProjet.id, sousProjet.Affectations, loadAdherents]);

  const filteredAdherents = useMemo(() => {
    if (!searchTerm.trim()) return adherents;
    const search = searchTerm.trim().toLowerCase();
    return adherents.filter((adh) => {
      return (
        adh.firstname?.toLowerCase().includes(search) ||
        adh.lastname?.toLowerCase().includes(search) ||
        adh.email?.toLowerCase().includes(search)
      );
    });
  }, [adherents, searchTerm]);

  const toggleAdherent = useCallback((adherentId: string) => {
    setSelectedAdherents((prev) => {
      const next = new Set(prev);
      if (next.has(adherentId)) next.delete(adherentId);
      else next.add(adherentId);
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (selectedAdherents.size === 0) {
      toast.error("Veuillez sélectionner au moins un adhérent");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("sousProjetId", sousProjet.id);
      form.append("adherentIds", JSON.stringify(Array.from(selectedAdherents)));
      form.append("responsable", "false");

      const result = await affecterSousProjet(form);
      if (result.success) {
        toast.success(result.message);
        onSuccess();
        onClose();
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

  if (!open) return null;

  return (
    <div className="mt-3 rounded-lg border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-indigo-600" />
          <div className="text-sm font-semibold text-slate-900">
            Affecter des adhérents à : <span className="text-indigo-700">{sousProjet.titre}</span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
          className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs sm:text-sm"
        >
          Fermer
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher un adhérent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {loadingAdherents ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 space-y-2">
            {filteredAdherents.length > 0 ? (
              filteredAdherents.map((adherent) => {
                const isSelected = selectedAdherents.has(adherent.id);
                return (
                  <div
                    key={adherent.id}
                    className="flex items-center gap-2 rounded-md p-2 hover:bg-slate-50 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleAdherent(adherent.id);
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleAdherent(adherent.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Label className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-medium text-slate-900">
                          {adherent.firstname} {adherent.lastname}
                        </span>
                        {adherent.email && (
                          <span className="text-xs text-slate-500">({adherent.email})</span>
                        )}
                      </div>
                    </Label>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">Aucun adhérent trouvé</p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-indigo-100">
          <div className="text-xs sm:text-sm text-slate-600">
            {selectedAdherents.size} adhérent(s) sélectionné(s)
          </div>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || selectedAdherents.size === 0}
            className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Enregistrer ({selectedAdherents.size})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

