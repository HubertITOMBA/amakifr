"use client"

import {
    Dialog,
    DialogOverlay,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
 


export function Modal ({
        children,
        title,
        confirmOnClose,
        confirmCloseMessage,
        showFooter,
        saveLabel,
        cancelLabel,
        onSave,
        onCancel,
        showClose = true,
        fullScreenOnMobile = false,
    }:{
        children: React.ReactNode;
        title?: string;
        confirmOnClose?: boolean;
        confirmCloseMessage?: string;
        showFooter?: boolean;
        saveLabel?: string;
        cancelLabel?: string;
        onSave?: () => void;
        onCancel?: () => void;
        showClose?: boolean;
        fullScreenOnMobile?: boolean;
    }) {
        const router = useRouter();

        const tryClose = () => {
            if (confirmOnClose) {
                const ok = window.confirm(confirmCloseMessage || "Vos modifications non sauvegardées seront perdues. Voulez-vous fermer ?");
                if (!ok) return;
            }
            if (onCancel) {
                onCancel();
                return;
            }
            router.back();
        };

        const handleOpenChange = (open?: boolean) => {
            if (open === false) {
                tryClose();
            }
        }

        const handleSave = () => {
            if (onSave) {
                onSave();
                return;
            }
            // Par défaut, notifier le contenu d'exécuter une sauvegarde
            window.dispatchEvent(new CustomEvent("modal-save"));
        };

        const contentClass = fullScreenOnMobile
          ? "w-screen h-screen sm:w-[95vw] sm:max-w-3xl md:max-w-5xl lg:max-w-6xl sm:max-h-[90vh] p-0 overflow-hidden flex flex-col"
          : "w-[95vw] sm:max-w-3xl md:max-w-5xl lg:max-w-6xl max-h-[90vh] p-0 overflow-hidden flex flex-col";

        const bodyClass = fullScreenOnMobile
          ? "flex-1 overflow-y-auto p-4 min-h-0"
          : "flex-1 overflow-y-auto p-4 min-h-0";

        return (
            <Dialog defaultOpen={true} open={true} onOpenChange={handleOpenChange}>
                <DialogOverlay className="bg-black/50" />
                <DialogContent className={`${contentClass} !pt-0`}>
                    <div className="flex items-center justify-between px-4 !pt-0 pb-3 border-b bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur rounded-t-lg">
                        {title ? (
                          <DialogTitle className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 truncate m-0 pt-3">
                              {title}
                          </DialogTitle>
                        ) : (
                          <DialogTitle className="sr-only">Modal</DialogTitle>
                        )}
                        {showClose && (
                          <button type="button" aria-label="Fermer" className="p-2 rounded hover:bg-muted mt-3" onClick={tryClose}>
                              <X className="h-5 w-5" />
                          </button>
                        )}
                    </div>
                    <div className={bodyClass}>
                        {children}
                    </div>
                    {showFooter && (
                        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-slate-50/60 dark:bg-slate-900/50 shrink-0">
                            <Button variant="outline" onClick={tryClose}>
                                {cancelLabel || "Annuler"}
                            </Button>
                            <Button onClick={handleSave}>
                                {saveLabel || "Enregistrer"}
                            </Button>
                        </div>
                    )}
                </DialogContent>
                    
            </Dialog>
        )
    }