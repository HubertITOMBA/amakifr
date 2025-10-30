"use client"

import {
    Dialog,
    DialogOverlay,
    DialogContent,
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

        return (
            <Dialog defaultOpen={true} open={true} onOpenChange={handleOpenChange}>
                <DialogOverlay className="bg-black/50" />
                <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-5xl lg:max-w-6xl max-h-[90vh] p-0 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur">
                        <div className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                            {title}
                        </div>
                        {showClose && (
                          <button type="button" aria-label="Fermer" className="p-2 rounded hover:bg-muted" onClick={tryClose}>
                              <X className="h-5 w-5" />
                          </button>
                        )}
                    </div>
                    <div className="max-h-[calc(90vh-52px)] overflow-y-auto p-4">
                        {children}
                    </div>
                    {showFooter && (
                        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-slate-50/60 dark:bg-slate-900/50">
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