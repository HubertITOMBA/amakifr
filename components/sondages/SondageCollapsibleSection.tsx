"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SondageCollapsibleSectionProps {
  /** Titre affiché dans la barre (ex. « Modifier les dates »). */
  title: string;
  /** Contenu déplié. */
  children: ReactNode;
  /** Icône optionnelle avant le titre. */
  icon?: ReactNode;
  /** Ouvert au montage. */
  defaultOpen?: boolean;
  /** Classes supplémentaires sur le conteneur (ex. max-w-3xl). */
  className?: string;
}

/**
 * Section repliable admin : barre entière cliquable et accessible clavier,
 * chevron contrasté, état ouvert/fermé exposé aux lecteurs d’écran.
 */
export function SondageCollapsibleSection({
  title,
  children,
  icon,
  defaultOpen = false,
  className,
}: SondageCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-slate-50/80 open:bg-white w-full",
        open && "bg-white",
        className
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 sm:gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800 rounded-lg hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-slate-800 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
        <span className="inline-flex items-center gap-1.5 min-w-0 flex-1">
          {icon}
          {title}
        </span>
        <span className="text-xs font-normal text-slate-500 shrink-0" aria-hidden>
          {open ? "Masquer" : "Afficher"}
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        hidden={!open}
        className={cn("px-4 pb-4", !open && "hidden")}
      >
        {open ? children : null}
      </div>
    </div>
  );
}
