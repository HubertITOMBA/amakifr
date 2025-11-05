"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { sendEventInvitations, getEligibleUsersForInvitation } from "@/actions/evenements/send-invitations";
import { toast } from "sonner";
import { Mail, Loader2, Users, UserCheck } from "lucide-react";
import { UserStatus } from "@prisma/client";

interface EventInvitationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evenementId: string;
  evenementTitre: string;
}

type SelectionMode = "all" | "selected";

interface User {
  id: string;
  name: string;
  email: string | null;
  status: UserStatus;
}

export function EventInvitationModal({
  open,
  onOpenChange,
  evenementId,
  evenementTitre,
}: EventInvitationModalProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("all");
  const [includeInactifs, setIncludeInactifs] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const result = await getEligibleUsersForInvitation(includeInactifs);
      if (result.success && result.users) {
        setAvailableUsers(result.users.filter(u => u.email) as User[]);
      } else {
        toast.error(result.error || "Erreur lors du chargement des utilisateurs");
      }
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setLoadingUsers(false);
    }
  }, [includeInactifs]);

  // Charger les utilisateurs disponibles
  useEffect(() => {
    if (open && selectionMode === "selected") {
      loadUsers();
    }
  }, [open, selectionMode, loadUsers]);

  const handleSend = async () => {
    if (selectionMode === "selected" && selectedUserIds.length === 0) {
      toast.error("Veuillez sélectionner au moins un membre");
      return;
    }

    setIsSending(true);
    try {
      const result = await sendEventInvitations({
        evenementId,
        userIds: selectionMode === "all" ? null : selectedUserIds,
        includeInactifs,
      });

      if (result.success) {
        toast.success(
          `${result.sentCount || 0} invitation(s) envoyée(s) avec succès${result.failedCount ? ` (${result.failedCount} échec(s))` : ""}`
        );
        handleCancel();
      } else {
        toast.error(result.error || "Erreur lors de l'envoi des invitations");
      }
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'envoi des invitations");
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    setSelectionMode("all");
    setIncludeInactifs(false);
    setSelectedUserIds([]);
    setAvailableUsers([]);
    onOpenChange(false);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAll = () => {
    setSelectedUserIds(availableUsers.map(u => u.id));
  };

  const deselectAll = () => {
    setSelectedUserIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Envoyer des invitations
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
            <strong>Événement :</strong> {evenementTitre}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mode de sélection</Label>
              <RadioGroup value={selectionMode} onValueChange={(value) => setSelectionMode(value as SelectionMode)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="font-normal cursor-pointer">
                    Tous les membres {includeInactifs ? "(actifs et inactifs)" : "(actifs uniquement)"}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="font-normal cursor-pointer">
                    Sélectionner manuellement
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {selectionMode === "all" && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-inactifs"
                    checked={includeInactifs}
                    onCheckedChange={(checked) => setIncludeInactifs(!!checked)}
                  />
                  <Label htmlFor="include-inactifs" className="font-normal cursor-pointer">
                    Inclure les membres inactifs
                  </Label>
                </div>
              </div>
            )}

            {selectionMode === "selected" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Membres à inviter</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAll}
                      disabled={loadingUsers}
                    >
                      Tout sélectionner
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deselectAll}
                      disabled={loadingUsers}
                    >
                      Tout désélectionner
                    </Button>
                  </div>
                </div>

                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto border rounded-md">
                    {availableUsers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        Aucun membre disponible
                      </div>
                    ) : (
                      <div className="divide-y">
                        {availableUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <Checkbox
                              id={`user-${user.id}`}
                              checked={selectedUserIds.includes(user.id)}
                              onCheckedChange={() => toggleUserSelection(user.id)}
                            />
                            <Label
                              htmlFor={`user-${user.id}`}
                              className="flex-1 cursor-pointer flex items-center justify-between"
                            >
                              <span>{user.name}</span>
                              <div className="flex items-center gap-2">
                                {user.status === UserStatus.Actif ? (
                                  <UserCheck className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Users className="h-4 w-4 text-gray-400" />
                                )}
                                <span className="text-xs text-gray-500">{user.email}</span>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedUserIds.length > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {selectedUserIds.length} membre(s) sélectionné(s)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSending}
          >
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={isSending || (selectionMode === "selected" && selectedUserIds.length === 0)}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Envoyer les invitations
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

