"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, X } from "lucide-react";
import { getAllUsersForAdmin } from "@/actions/user";

interface AdherentSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (adherent: { id: string; firstname: string; lastname: string; email: string }) => void;
  title?: string;
  description?: string;
}

export function AdherentSearchDialog({
  open,
  onOpenChange,
  onSelect,
  title = "Rechercher un adhérent",
  description = "Tapez le nom, prénom ou email de l'adhérent",
}: AdherentSearchDialogProps) {
  const [adherents, setAdherents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (open) {
      loadAdherents();
    } else {
      setSearchTerm("");
    }
  }, [open]);

  const loadAdherents = async () => {
    try {
      setLoading(true);
      const res = await getAllUsersForAdmin();
      if (res.success && res.users) {
        setAdherents(res.users.filter((u: any) => u.adherent));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredAdherents = useMemo(() => {
    if (!searchTerm.trim()) {
      return adherents.slice(0, 20); // Limiter à 20 résultats par défaut
    }

    const query = searchTerm.toLowerCase().trim();
    return adherents
      .filter((user) => {
        const firstname = user.adherent?.firstname?.toLowerCase() || "";
        const lastname = user.adherent?.lastname?.toLowerCase() || "";
        const email = user.email?.toLowerCase() || "";
        const fullName = `${firstname} ${lastname}`.toLowerCase();

        return (
          firstname.includes(query) ||
          lastname.includes(query) ||
          email.includes(query) ||
          fullName.includes(query)
        );
      })
      .slice(0, 50); // Limiter à 50 résultats lors de la recherche
  }, [adherents, searchTerm]);

  const handleSelect = (user: any) => {
    onSelect({
      id: user.adherent.id,
      firstname: user.adherent.firstname,
      lastname: user.adherent.lastname,
      email: user.email,
    });
    onOpenChange(false);
    setSearchTerm("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom, prénom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-28"
              autoFocus
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Liste des adhérents */}
          <div className="flex-1 overflow-y-auto border rounded-md">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredAdherents.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {searchTerm ? "Aucun adhérent trouvé" : "Commencez à taper pour rechercher"}
              </div>
            ) : (
              <div className="divide-y">
                {filteredAdherents.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelect(user)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-3"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {user.adherent?.firstname} {user.adherent?.lastname}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Compteur */}
          {!loading && filteredAdherents.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {filteredAdherents.length} adhérent(s) trouvé(s)
              {searchTerm && adherents.length > filteredAdherents.length && (
                <span> sur {adherents.length}</span>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

