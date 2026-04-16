"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, User, X } from "lucide-react";
import { getAllUsersForAdmin } from "@/actions/user";
import { cn } from "@/lib/utils";

export interface InlineAdherentSearchPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (adherent: { id: string; firstname: string; lastname: string; email: string }) => void;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Panneau inline de recherche d'adhérent (sans Dialog) pour éviter les dialogs imbriqués.
 */
export function InlineAdherentSearchPanel({
  open,
  onOpenChange,
  onSelect,
  title = "Rechercher un adhérent",
  description = "Tapez le nom, prénom ou email de l'adhérent",
  className,
}: InlineAdherentSearchPanelProps) {
  const [adherents, setAdherents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
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
        setLoading(false);
      }
    };

    load();
  }, [open]);

  const filteredAdherents = useMemo(() => {
    if (!open) return [];
    if (!searchTerm.trim()) return adherents.slice(0, 20);
    const query = searchTerm.toLowerCase().trim();
    return adherents
      .filter((user) => {
        const firstname = user.adherent?.firstname?.toLowerCase() || "";
        const lastname = user.adherent?.lastname?.toLowerCase() || "";
        const email = user.email?.toLowerCase() || "";
        const fullName = `${firstname} ${lastname}`.toLowerCase();
        return firstname.includes(query) || lastname.includes(query) || email.includes(query) || fullName.includes(query);
      })
      .slice(0, 50);
  }, [open, adherents, searchTerm]);

  if (!open) return null;

  return (
    <div className={cn("mt-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-900/10 p-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{title}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{description}</div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          Fermer
        </Button>
      </div>

      <div className="mt-3 space-y-3">
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
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900">
          {loading ? (
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
                    onSelect({
                      id: user.adherent.id,
                      firstname: user.adherent.firstname,
                      lastname: user.adherent.lastname,
                      email: user.email,
                    });
                    onOpenChange(false);
                    setSearchTerm("");
                  }}
                  className="w-full p-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3"
                >
                  <div className="shrink-0">
                    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {user.adherent?.firstname} {user.adherent?.lastname}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!loading && filteredAdherents.length > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {filteredAdherents.length} adhérent(s) trouvé(s)
            {searchTerm && adherents.length > filteredAdherents.length && <span> sur {adherents.length}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

