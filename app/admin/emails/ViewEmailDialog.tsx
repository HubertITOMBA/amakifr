"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Eye, Mail, User, Calendar, CheckCircle2, XCircle, UserCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ViewEmailDialogProps {
  email: {
    id: string;
    subject: string;
    body: string;
    recipientEmail: string;
    sent: boolean;
    error?: string | null;
    createdAt: string | Date;
    User?: {
      name?: string | null;
      email?: string | null;
      adherent?: {
        firstname?: string | null;
        lastname?: string | null;
      } | null;
    } | null;
    CreatedBy?: {
      name?: string | null;
      email?: string | null;
    } | null;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactNode;
}

/**
 * Composant Dialog pour afficher les détails complets d'un email envoyé
 * 
 * @param email - L'email à afficher avec tous ses détails
 * @param open - État contrôlé d'ouverture (optionnel)
 * @param onOpenChange - Callback pour changer l'état d'ouverture (optionnel)
 * @param triggerButton - Bouton personnalisé pour déclencher l'ouverture (optionnel)
 */
export function ViewEmailDialog({ 
  email, 
  open: controlledOpen, 
  onOpenChange, 
  triggerButton 
}: ViewEmailDialogProps) {
  const open = controlledOpen !== undefined ? controlledOpen : false;
  const setOpen = onOpenChange || (() => {});

  const recipientName = email.User?.adherent
    ? `${email.User.adherent.firstname || ""} ${email.User.adherent.lastname || ""}`.trim() || email.User?.name || "—"
    : email.User?.name || "—";

  return (
    <>
      {triggerButton ? (
        <div onClick={() => setOpen(true)}>{triggerButton}</div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50"
          onClick={() => setOpen(true)}
          title="Voir les détails"
        >
          <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white p-6 rounded-t-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-white mb-1">
                    Détails de l'email
                  </DialogTitle>
                  <DialogDescription className="text-blue-100 text-sm">
                    Informations complètes sur l'email envoyé
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Statut */}
            <div className="flex items-center justify-center">
              {email.sent ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-2 px-4 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Email envoyé avec succès
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex items-center gap-2 px-4 py-2 text-sm">
                  <XCircle className="h-4 w-4" />
                  Échec de l'envoi
                </Badge>
              )}
            </div>

            {/* Informations principales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Destinataire */}
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                  <User className="h-3 w-3" />
                  Destinataire
                </label>
                <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm">
                  <div className="font-semibold">{recipientName}</div>
                  <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                    {email.recipientEmail || email.User?.email || "—"}
                  </div>
                </div>
              </div>

              {/* Expéditeur */}
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                  <UserCircle className="h-3 w-3" />
                  Expéditeur
                </label>
                <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm">
                  <div className="font-semibold">{email.CreatedBy?.name || "—"}</div>
                  <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                    {email.CreatedBy?.email || "—"}
                  </div>
                </div>
              </div>

              {/* Date d'envoi */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                  <Clock className="h-3 w-3" />
                  Date d'envoi
                </label>
                <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm">
                  {format(new Date(email.createdAt), "PPpp", { locale: fr })}
                </div>
              </div>
            </div>

            {/* Objet */}
            <div className="space-y-1">
              <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                <Mail className="h-3 w-3" />
                Objet
              </label>
              <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm">
                {email.subject}
              </div>
            </div>

            {/* Corps du message */}
            <div className="space-y-1">
              <label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 px-2 py-1 rounded-t-md">
                <Mail className="h-3 w-3" />
                Corps du message
              </label>
              <div 
                className="p-4 sm:p-5 bg-blue-50 dark:bg-blue-900/20 rounded-md rounded-tl-none border border-blue-200 dark:border-blue-800 border-t-0 text-xs sm:text-sm text-slate-900 dark:text-slate-100 shadow-sm min-h-[200px] whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: email.body.replace(/\n/g, '<br>') }}
              />
            </div>

            {/* Message d'erreur si échec */}
            {!email.sent && email.error && (
              <div className="space-y-1">
                <label className="text-[9px] sm:text-[10px] font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-red-100 px-2 py-1 rounded-t-md">
                  <XCircle className="h-3 w-3" />
                  Message d'erreur
                </label>
                <div className="p-2 sm:p-2.5 bg-red-50 dark:bg-red-900/20 rounded-md rounded-tl-none border border-red-200 dark:border-red-800 border-t-0 text-xs sm:text-sm font-medium text-red-900 dark:text-red-100 shadow-sm">
                  {email.error}
                </div>
              </div>
            )}

            {/* Bouton de fermeture */}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900 text-xs sm:text-sm shadow-sm"
              >
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
