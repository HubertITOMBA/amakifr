"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, User, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

interface UserSearchComboboxProps {
  users: User[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function UserSearchCombobox({
  users,
  value,
  onValueChange,
  placeholder = "Rechercher un utilisateur...",
  disabled = false,
}: UserSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedUser = users.find((user) => user.id === value);

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

  const displayName = selectedUser
    ? selectedUser.adherent
      ? `${selectedUser.adherent.firstname} ${selectedUser.adherent.lastname}`
      : selectedUser.name || selectedUser.email
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-sm h-9 sm:h-10"
          disabled={disabled}
        >
          <span className="truncate flex-1 text-left">
            {selectedUser ? (
              <span className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">{displayName}</span>
                {selectedUser.email && (
                  <span className="text-xs text-gray-500 truncate hidden sm:inline">
                    ({selectedUser.email})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            )}
          </span>
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
              {filteredUsers.map((user) => {
                const userName = user.adherent
                  ? `${user.adherent.firstname} ${user.adherent.lastname}`
                  : user.name || user.email || "Utilisateur";
                return (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => {
                      onValueChange(user.id === value ? "" : user.id);
                      setOpen(false);
                      setSearchTerm("");
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === user.id ? "opacity-100" : "opacity-0"
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

