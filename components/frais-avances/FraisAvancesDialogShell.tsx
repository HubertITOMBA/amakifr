"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Classes header dégradé bleu AMAKI (aligné notifications admin). */
export const FRAIS_AVANCES_DIALOG_HEADER_CLASS =
  "bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white px-4 sm:px-5 pt-4 sm:pt-5 pb-2.5 rounded-t-lg";

/** Conteneur Dialog : densifié, overflow uniquement filet de sécurité. */
export const FRAIS_AVANCES_DIALOG_CONTENT_CLASS =
  "w-[95vw] sm:w-full max-w-lg max-h-[min(90vh,720px)] overflow-y-auto p-0 overflow-x-hidden gap-0";

export const FRAIS_AVANCES_DIALOG_BODY_CLASS =
  "px-4 sm:px-5 py-3 bg-white dark:bg-gray-900 space-y-3";

export const FRAIS_AVANCES_DIALOG_FOOTER_CLASS =
  "flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700";

export const FRAIS_AVANCES_SECTION_CLASS =
  "rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-2.5 sm:p-3 space-y-2";

export const FRAIS_AVANCES_SECTION_BLUE_CLASS =
  "rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-2.5 sm:p-3 space-y-2";

export const FRAIS_AVANCES_LABEL_CLASS =
  "text-xs font-semibold text-slate-700 dark:text-slate-200";

export const FRAIS_AVANCES_INPUT_CLASS =
  "text-sm h-9 border-slate-300 dark:border-slate-600";

type FraisAvancesDialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  testId?: string;
};

/**
 * Coquille visuelle commune des dialogues frais avancés (header dégradé + corps + footer).
 *
 * DialogDescription sans id custom : Radix lie aria-describedby via context.descriptionId.
 * Un id forcé désynchronisait getElementById et déclenchait le warning « Missing Description ».
 */
export function FraisAvancesDialogShell({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  contentClassName,
  testId,
}: FraisAvancesDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(FRAIS_AVANCES_DIALOG_CONTENT_CLASS, contentClassName)}
        showCloseButton={false}
        data-testid={testId}
      >
        <DialogHeader className={FRAIS_AVANCES_DIALOG_HEADER_CLASS}>
          <DialogTitle className="text-white text-base sm:text-lg font-bold flex items-center gap-2">
            {icon ? <span className="shrink-0">{icon}</span> : null}
            {title}
          </DialogTitle>
          <DialogDescription className="text-blue-50 dark:text-blue-100 text-xs sm:text-sm mt-1.5">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className={FRAIS_AVANCES_DIALOG_BODY_CLASS}>
          {children}
          {footer ? (
            <div
              className={FRAIS_AVANCES_DIALOG_FOOTER_CLASS}
              data-testid={testId ? `${testId}-footer` : undefined}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
