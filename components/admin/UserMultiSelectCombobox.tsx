"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, User, Search, X, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface User {
  id: string;
  name: string | null;
  email: string | null;
  adherent?: {
    firstname: string | null;
    lastname: string | null;
  } | null;
}

interface UserMultiSelectComboboxProps {
  users: User[];
  value?: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  showAllOption?: boolean;
}

export function UserMultiSelectCombobox({
  users,
  value = [],
  onValueChange,
  placeholder = "Rechercher des utilisateurs...",
  disabled = false,
  showAllOption = true,
}: UserMultiSelectComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedUsers = useMemo(() => {
    return users.filter((user) => value.includes(user.id));
  }, [users, value]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) {
      return users.slice(0, 50);
    }

    const query = searchTerm.toLowerCase().trim();
    return users.filter((user) => {
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
  }, [users, searchTerm]);

  const isAllSelected = value.length === users.length && users.length > 0;

  const handleSelectAll = () => {
    if (isAllSelected) {
      onValueChange([]);
    } else {
      onValueChange(users.map((u) => u.id));
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
            ) : isAllSelected && showAllOption ? (
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
      <PopoverContent className="w-full p-0" align="start">
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
          <CommandList>
            <CommandEmpty>Aucun utilisateur trouvé.</CommandEmpty>
            <CommandGroup>
              {showAllOption && (
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
                  {isAllSelected ? "Désélectionner tous" : "Sélectionner tous les adhérents"}
                </CommandItem>
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
                        {user.email && (
                          <div className="text-xs text-gray-500 truncate">
                            {user.email}
                          </div>
                        )}
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

