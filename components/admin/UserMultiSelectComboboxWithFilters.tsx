"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, User, Search, X, Users as UsersIcon, Filter, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  status?: string | null;
  role?: string | null;
  adherent?: {
    firstname: string | null;
    lastname: string | null;
  } | null;
}

interface UserMultiSelectComboboxWithFiltersProps {
  users: User[];
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  showAllOption?: boolean;
}

export function UserMultiSelectComboboxWithFilters({
  users,
  value = [],
  onValueChange,
  placeholder = "Rechercher des utilisateurs...",
  disabled = false,
  showAllOption = true,
}: UserMultiSelectComboboxWithFiltersProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const selectedUsers = useMemo(() => {
    return users.filter((user) => value.includes(user.id));
  }, [users, value]);

  // Obtenir les statuts et rôles uniques
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(users.map(u => u.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [users]);

  const uniqueRoles = useMemo(() => {
    const roles = new Set(users.map(u => u.role).filter(Boolean));
    return Array.from(roles).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Filtre par recherche
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((user) => {
        const name = user.name?.toLowerCase() || "";
        const email = user.email?.toLowerCase() || "";
        const firstname = user.adherent?.firstname?.toLowerCase() || "";
        const lastname = user.adherent?.lastname?.toLowerCase() || "";
        const fullName = `${firstname} ${lastname}`.toLowerCase();

        return (
          name.includes(query) ||
          email.includes(query) ||
          firstname.includes(query) ||
          lastname.includes(query) ||
          fullName.includes(query)
        );
      });
    }

    // Filtre par statut
    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => user.status === statusFilter);
    }

    // Filtre par rôle
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    return filtered.slice(0, 100); // Limiter à 100 résultats
  }, [users, searchTerm, statusFilter, roleFilter]);

  const isAllSelected = value.length === filteredUsers.length && filteredUsers.length > 0;

  const handleSelectAll = () => {
    if (isAllSelected) {
      onValueChange(value.filter(id => !filteredUsers.some(u => u.id === id)));
    } else {
      const newIds = filteredUsers.map((u) => u.id).filter(id => !value.includes(id));
      onValueChange([...value, ...newIds]);
    }
  };

  const handleToggleUser = (userId: string) => {
    if (value.includes(userId)) {
      onValueChange(value.filter((id) => id !== userId));
    } else {
      onValueChange([...value, userId]);
    }
  };

  const handleRemoveUser = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(value.filter((id) => id !== userId));
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setRoleFilter("all");
    setSearchTerm("");
  };

  const hasActiveFilters = statusFilter !== "all" || roleFilter !== "all" || searchTerm.trim() !== "";

  const getDisplayName = (user: User) => {
    if (user.adherent) {
      return `${user.adherent.firstname} ${user.adherent.lastname}`.trim() || user.name || user.email || "Utilisateur";
    }
    return user.name || user.email || "Utilisateur";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-sm h-auto min-h-[2.5rem] py-1.5 px-3"
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1 flex-1 text-left min-w-0">
            {selectedUsers.length === 0 ? (
              <span className="text-gray-500 py-1">{placeholder}</span>
            ) : value.length === users.length && showAllOption ? (
              <Badge variant="secondary" className="mr-1">
                <UsersIcon className="h-3 w-3 mr-1" />
                Tous les adhérents ({users.length})
              </Badge>
            ) : (
              <>
                {selectedUsers.slice(0, 3).map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="mr-1 max-w-[150px]"
                  >
                    <span className="truncate">{getDisplayName(user)}</span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveUser(user.id, e)}
                      className="ml-1 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {selectedUsers.length > 3 && (
                  <Badge variant="secondary" className="mr-1">
                    +{selectedUsers.length - 3}
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Rechercher par nom, prénom ou email..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Filtres */}
          <div className="border-b px-3 py-2 space-y-2 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-3 w-3 text-gray-500" />
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Filtres</span>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 px-2 text-xs"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Réinitialiser
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {uniqueStatuses.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Statut</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {uniqueStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {uniqueRoles.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Rôle</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {uniqueRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {hasActiveFilters && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {filteredUsers.length} résultat(s) trouvé(s)
              </div>
            )}
          </div>

          <CommandList>
            <CommandEmpty>
              {hasActiveFilters ? "Aucun utilisateur ne correspond aux filtres." : "Aucun utilisateur trouvé."}
            </CommandEmpty>
            <CommandGroup>
              {showAllOption && filteredUsers.length > 0 && (
                <>
                  <CommandItem
                    onSelect={handleSelectAll}
                    className="cursor-pointer font-semibold"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isAllSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <UsersIcon className="mr-2 h-4 w-4" />
                    {isAllSelected ? "Désélectionner les résultats" : `Sélectionner tous les résultats (${filteredUsers.length})`}
                  </CommandItem>
                  <Separator />
                </>
              )}
              {filteredUsers.map((user) => {
                const userName = getDisplayName(user);
                const isSelected = value.includes(user.id);
                return (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => handleToggleUser(user.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {userName}
                        </div>
                        <div className="flex items-center gap-2">
                          {user.email && (
                            <div className="text-xs text-gray-500 truncate">
                              {user.email}
                            </div>
                          )}
                          {user.status && (
                            <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                              {user.status}
                            </Badge>
                          )}
                          {user.role && user.role !== "Membre" && (
                            <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                              {user.role}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

