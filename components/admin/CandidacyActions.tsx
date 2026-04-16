"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { CheckCircle, XCircle } from "lucide-react";
import { CandidacyStatus } from "@prisma/client";

interface CandidacyActionsProps {
  candidacyId: string;
  candidacyName: string;
  position: string;
  onStatusUpdate: (candidacyId: string, status: CandidacyStatus) => Promise<void>;
  disabled?: boolean;
}

export function CandidacyActions({ 
  candidacyId, 
  candidacyName, 
  position, 
  onStatusUpdate, 
  disabled = false 
}: CandidacyActionsProps) {
  const [actionDialog, setActionDialog] = useState<"approve" | "reject" | null>(null);
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    try {
      setLoading(true);
      await onStatusUpdate(candidacyId, CandidacyStatus.Validee);
      setActionDialog(null);
    } catch (error) {
      console.error("Erreur lors de l'approbation:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setLoading(true);
      await onStatusUpdate(candidacyId, CandidacyStatus.Rejetee);
      setActionDialog(null);
    } catch (error) {
      console.error("Erreur lors du rejet:", error);
    } finally {
      setLoading(false);
    }
  };

  const isApprove = actionDialog === "approve";
  const isReject = actionDialog === "reject";

  return (
    <>
      <div className="flex items-center space-x-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setActionDialog("approve")}
          disabled={disabled || loading}
          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
          title="Approuver la candidature"
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setActionDialog("reject")}
          disabled={disabled || loading}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Rejeter la candidature"
        >
          <XCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* Dialog unique (évite empilement de dialogs) */}
      <Dialog open={actionDialog !== null} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isApprove ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Approuver la candidature
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Rejeter la candidature
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isApprove ? (
                <>
                  Êtes-vous sûr de vouloir approuver la candidature de <strong>{candidacyName}</strong> pour le poste de{" "}
                  <strong>{position}</strong> ?
                </>
              ) : (
                <>
                  Êtes-vous sûr de vouloir rejeter la candidature de <strong>{candidacyName}</strong> pour le poste de{" "}
                  <strong>{position}</strong> ?
                  <br />
                  <span className="text-red-600 font-medium">Cette action ne peut pas être annulée.</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog(null)}
              disabled={loading}
            >
              Annuler
            </Button>
            {isApprove ? (
              <Button onClick={handleApprove} disabled={loading} className="bg-green-600 hover:bg-green-700">
                {loading ? "Approbation..." : "Approuver"}
              </Button>
            ) : (
              <Button onClick={handleReject} disabled={loading} variant="destructive">
                {loading ? "Rejet..." : "Rejeter"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
