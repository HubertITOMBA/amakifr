"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export type UnpublishRapportTarget = {
  id: string;
  titre: string;
};

export type UnpublishRapportResult = {
  success: boolean;
  message?: string;
  error?: string;
};

type Props = {
  open: boolean;
  rapport: UnpublishRapportTarget | null;
  onOpenChange: (open: boolean) => void;
  /** Injection pour tests ; défaut : Server Action réelle. */
  unpublishAction: (rapportId: string) => Promise<UnpublishRapportResult>;
  /** Appelé après succès (ex. reload liste). */
  onSuccess?: () => void;
};

/**
 * Confirmation de dépublication (AlertDialog) — remplace window.confirm
 * incompatible avec DropdownMenuItem Radix.
 */
export function UnpublishRapportDialog({
  open,
  rapport,
  onOpenChange,
  unpublishAction,
  onSuccess,
}: Props) {
  const [pending, setPending] = useState(false);
  const inFlightRef = useRef(false);

  const handleOpenChange = (next: boolean) => {
    if (pending && !next) return;
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (!rapport?.id || inFlightRef.current || pending) return;
    inFlightRef.current = true;
    setPending(true);
    try {
      const result = await unpublishAction(rapport.id);
      if (result.success) {
        toast.success(
          result.message ||
            "Rapport repassé en brouillon. Les adhérents ne peuvent plus le consulter."
        );
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "Action impossible");
        // dialog reste ouvert pour réessayer
      }
    } catch {
      toast.error("Erreur lors du retour en brouillon");
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent data-testid="unpublish-rapport-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Repasser ce rapport en brouillon ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le rapport &quot;{rapport?.titre || "—"}&quot; ne sera plus visible
            par les adhérents. Vous pourrez le republier plus tard.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            data-testid="unpublish-rapport-confirm"
            disabled={pending || !rapport?.id}
            onClick={(e) => {
              // Empêche la fermeture automatique Radix avant la fin de l’action
              e.preventDefault();
              void handleConfirm();
            }}
            className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />
                Traitement…
              </>
            ) : (
              "Repasser en brouillon"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
