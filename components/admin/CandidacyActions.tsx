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
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
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
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    try {
      setLoading(true);
      await onStatusUpdate(candidacyId, CandidacyStatus.Validee);
      setShowApproveDialog(false);
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
      setShowRejectDialog(false);
    } catch (error) {
      console.error("Erreur lors du rejet:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowApproveDialog(true)}
          disabled={disabled || loading}
          className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
          title="Approuver la candidature"
        >
          <CheckCircle className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowRejectDialog(true)}
          disabled={disabled || loading}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Rejeter la candidature"
        >
          <XCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* Dialog d'approbation */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Approuver la candidature
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir approuver la candidature de <strong>{candidacyName}</strong> pour le poste de <strong>{position}</strong> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleApprove}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? "Approbation..." : "Approuver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de rejet */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Rejeter la candidature
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir rejeter la candidature de <strong>{candidacyName}</strong> pour le poste de <strong>{position}</strong> ?
              <br />
              <span className="text-red-600 font-medium">Cette action ne peut pas être annulée.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleReject}
              disabled={loading}
              variant="destructive"
            >
              {loading ? "Rejet..." : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
