"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchRappelDetteAdherentsAction } from "@/actions/cotisations/search-rappel-dette-adherents";
import {
  RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS,
  RAPPEL_DETTE_ADHERENT_SEARCH_TRUNCATED_MESSAGE,
  type RappelDetteAdherentSearchItem,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-adherent-search-constants";

const DEBOUNCE_MS = 300;

export type RappelsOperationsAdherentSearchSelection = {
  id: string;
  firstname: string;
  lastname: string;
  disambiguationLabel: string | null;
};

export type RappelsOperationsAdherentSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (adherent: RappelsOperationsAdherentSearchSelection) => void;
  title?: string;
  description?: string;
};

type SearchUiState =
  | { kind: "idle" }
  | { kind: "below_threshold" }
  | { kind: "loading" }
  | { kind: "empty"; query: string }
  | {
      kind: "ready";
      query: string;
      items: RappelDetteAdherentSearchItem[];
      truncated: boolean;
    }
  | { kind: "error"; message: string };

/**
 * Dialogue de recherche d’adhérents dédié aux opérations rappels.
 * Appelle uniquement `searchRappelDetteAdherentsAction` (ADMIN|PRESID, borné).
 * Ignore les réponses obsolètes et celles après fermeture.
 */
export function RappelsOperationsAdherentSearch({
  open,
  onOpenChange,
  onSelect,
  title = "Rechercher un adhérent",
  description = "Recherchez un adhérent par nom ou prénom (au moins 2 caractères).",
}: RappelsOperationsAdherentSearchProps) {
  const inputId = useId();
  const listId = useId();
  const [searchTerm, setSearchTerm] = useState("");
  const [ui, setUi] = useState<SearchUiState>({ kind: "idle" });
  const openRef = useRef(open);
  const reqIdRef = useRef(0);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      setUi({ kind: "idle" });
      reqIdRef.current += 1;
    }
  }, [open]);

  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim().replace(/\s+/g, " ");
    if (q.length < RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS) {
      setUi(
        q.length === 0 ? { kind: "idle" } : { kind: "below_threshold" }
      );
      return;
    }
    const reqId = ++reqIdRef.current;
    setUi({ kind: "loading" });
    try {
      const res = await searchRappelDetteAdherentsAction({ query: q });
      if (!openRef.current || reqId !== reqIdRef.current) return;
      if (!res.success) {
        setUi({ kind: "error", message: res.error });
        return;
      }
      if (res.data.items.length === 0) {
        setUi({ kind: "empty", query: res.data.query });
        return;
      }
      setUi({
        kind: "ready",
        query: res.data.query,
        items: res.data.items,
        truncated: res.data.truncated,
      });
    } catch {
      if (!openRef.current || reqId !== reqIdRef.current) return;
      setUi({
        kind: "error",
        message: "Erreur réseau lors de la recherche d’adhérents",
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const q = searchTerm.trim();
    if (q.length < RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS) {
      setUi(q.length === 0 ? { kind: "idle" } : { kind: "below_threshold" });
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(searchTerm);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, searchTerm, runSearch]);

  const handleSelect = (item: RappelDetteAdherentSearchItem) => {
    onSelect({
      id: item.adherentId,
      firstname: item.firstname,
      lastname: item.lastname,
      disambiguationLabel: item.disambiguationLabel,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col font-sans">
        <DialogHeader>
          <DialogTitle className="font-sans text-base sm:text-lg text-slate-900">
            {title}
          </DialogTitle>
          <DialogDescription className="font-sans text-sm leading-relaxed text-slate-700">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
          <div className="space-y-1.5">
            <Label
              htmlFor={inputId}
              className="text-sm font-semibold text-slate-800"
            >
              Recherche
            </Label>
            <div className="relative">
              {/*
                Input global : px-4 sm:px-3 — sm:px-3 écraserait pl-10 sans sm:pl-10.
                pl-10 (2.5rem) réserve la loupe ; icône non interactive.
              */}
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"
                aria-hidden
              />
              <Input
                id={inputId}
                role="searchbox"
                aria-controls={listId}
                aria-autocomplete="list"
                placeholder="Nom ou prénom (min. 2 caractères)…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 sm:pl-10 pr-10 font-sans text-sm sm:text-base"
                autoFocus
              />
              {searchTerm ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  aria-label="Effacer la recherche"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          <div
            id={listId}
            role="listbox"
            aria-label="Résultats de recherche"
            className="flex-1 overflow-y-auto rounded-md border border-slate-200 min-h-[12rem]"
          >
            {ui.kind === "idle" ? (
              <p className="text-center py-8 font-sans text-sm sm:text-base leading-relaxed text-slate-600">
                Saisissez au moins {RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS}{" "}
                caractères.
              </p>
            ) : null}
            {ui.kind === "below_threshold" ? (
              <p
                role="status"
                className="text-center py-8 font-sans text-sm sm:text-base leading-relaxed text-amber-900"
              >
                Saisissez au moins {RAPPEL_DETTE_ADHERENT_SEARCH_MIN_CHARS}{" "}
                caractères pour lancer la recherche.
              </p>
            ) : null}
            {ui.kind === "loading" ? (
              <div
                role="status"
                className="flex items-center justify-center gap-2 py-8 text-sm text-slate-600"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Recherche en cours…
              </div>
            ) : null}
            {ui.kind === "empty" ? (
              <p role="status" className="text-center py-8 text-sm text-slate-500">
                Aucun adhérent trouvé pour « {ui.query} ».
              </p>
            ) : null}
            {ui.kind === "error" ? (
              <p role="alert" className="text-center py-8 text-sm text-red-700 px-3">
                {ui.message}
              </p>
            ) : null}
            {ui.kind === "ready" ? (
              <div className="divide-y">
                {ui.truncated ? (
                  <p
                    role="status"
                    className="px-3 py-2 text-xs text-amber-900 bg-amber-50 border-b border-amber-200"
                  >
                    {RAPPEL_DETTE_ADHERENT_SEARCH_TRUNCATED_MESSAGE}
                  </p>
                ) : null}
                {ui.items.map((item) => (
                  <button
                    key={item.adherentId}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full p-3 text-left hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 flex items-center gap-3"
                    onClick={() => handleSelect(item)}
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-blue-600" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {item.firstname} {item.lastname}
                      </p>
                      {item.disambiguationLabel ? (
                        <p className="text-xs text-slate-500 truncate">
                          {item.disambiguationLabel}
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
