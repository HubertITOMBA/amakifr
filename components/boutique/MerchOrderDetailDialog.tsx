"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Truck,
  User,
  CreditCard,
  CheckCircle2,
  XCircle,
  ShoppingBag,
} from "lucide-react";
import { toast } from "react-toastify";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { updateMerchOrderAdmin } from "@/actions/boutique";
import {
  formatMerchPrice,
  MERCH_ORDER_STATUS_LABELS,
  MERCH_PAYMENT_STATUS_LABELS,
  getMerchOrderStatusBadgeClass,
  getMerchPaymentStatusBadgeClass,
} from "@/lib/boutique";
import { formatPhoneInternational } from "@/lib/phone";

export interface MerchOrderDetail {
  id: string;
  numeroCommande: string;
  email: string;
  nom: string;
  telephone?: string | null;
  adresseLivraison: string;
  ville?: string | null;
  codePostal?: string | null;
  pays?: string | null;
  statut: string;
  statutPaiement?: string;
  montantTotal: number;
  notes?: string | null;
  notesAdmin?: string | null;
  referenceSuivi?: string | null;
  dateExpedition?: string | Date | null;
  dateCloture?: string | Date | null;
  confirmationEmailSentAt?: string | Date | null;
  confirmationEmailError?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
  items: Array<{
    id: string;
    productTitre: string;
    taille: string;
    couleur: string;
    prixUnitaire: number;
    quantite: number;
    sousTotal: number;
    imageCover?: string | null;
  }>;
  User?: { id: string; name: string | null; email: string | null } | null;
}

interface MerchOrderDetailDialogProps {
  order: MerchOrderDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (order: MerchOrderDetail) => void;
}

const ORDER_STATUSES = ["EnAttente", "Confirmee", "Expediee", "Livree", "Annulee"] as const;
const PAYMENT_STATUSES = ["EnAttente", "Recu", "Rembourse"] as const;

/**
 * Dialog de consultation et suivi admin d'une commande boutique
 */
export function MerchOrderDetailDialog({
  order,
  open,
  onOpenChange,
  onUpdated,
}: MerchOrderDetailDialogProps) {
  const [statut, setStatut] = useState("EnAttente");
  const [statutPaiement, setStatutPaiement] = useState("EnAttente");
  const [referenceSuivi, setReferenceSuivi] = useState("");
  const [notesAdmin, setNotesAdmin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!order) return;
    setStatut(order.statut);
    setStatutPaiement(order.statutPaiement || "EnAttente");
    setReferenceSuivi(order.referenceSuivi || "");
    setNotesAdmin(order.notesAdmin || "");
  }, [order]);

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const res = await updateMerchOrderAdmin({
        orderId: order.id,
        statut: statut as (typeof ORDER_STATUSES)[number],
        statutPaiement: statutPaiement as (typeof PAYMENT_STATUSES)[number],
        referenceSuivi: referenceSuivi || null,
        notesAdmin: notesAdmin || null,
      });
      if (res.success && res.data) {
        toast.success(res.message || "Commande mise à jour");
        onUpdated(res.data as MerchOrderDetail);
      } else {
        toast.error(res.error || "Erreur lors de la mise à jour");
      }
    } finally {
      setSaving(false);
    }
  };

  const applyQuickAction = async (
    nextStatut: string,
    nextPaiement?: string
  ) => {
    if (!order) return;
    setStatut(nextStatut);
    if (nextPaiement) setStatutPaiement(nextPaiement);
    setSaving(true);
    try {
      const res = await updateMerchOrderAdmin({
        orderId: order.id,
        statut: nextStatut as (typeof ORDER_STATUSES)[number],
        statutPaiement: (nextPaiement || statutPaiement) as (typeof PAYMENT_STATUSES)[number],
        referenceSuivi: referenceSuivi || null,
        notesAdmin: notesAdmin || null,
      });
      if (res.success && res.data) {
        toast.success(res.message || "Commande mise à jour");
        onUpdated(res.data as MerchOrderDetail);
      } else {
        toast.error(res.error || "Erreur");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  const formatDate = (value?: string | Date | null) =>
    value ? format(new Date(value), "dd MMM yyyy à HH:mm", { locale: fr }) : "—";

  const primaryItemImage = order.items.find((item) => item.imageCover)?.imageCover ?? null;

  const renderItemThumbnail = (src: string | null | undefined, alt: string) => (
    <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 dark:border-slate-700 shrink-0">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          unoptimized={src.startsWith("/")}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <ShoppingBag className="h-5 w-5 text-slate-400" />
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-lg sm:text-xl">
            <Package className="h-5 w-5 text-blue-600" />
            Commande {order.numeroCommande}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Passée le {formatDate(order.createdAt)}
          </p>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge className={getMerchOrderStatusBadgeClass(order.statut)}>
              {MERCH_ORDER_STATUS_LABELS[order.statut] || order.statut}
            </Badge>
            <Badge className={getMerchPaymentStatusBadgeClass(order.statutPaiement || "EnAttente")}>
              {MERCH_PAYMENT_STATUS_LABELS[order.statutPaiement || "EnAttente"]}
            </Badge>
            <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
              Total {formatMerchPrice(order.montantTotal)}
            </Badge>
          </div>

          {primaryItemImage && (
            <div className="flex items-center gap-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-3">
              <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-xl overflow-hidden bg-slate-100 border border-blue-200 shrink-0">
                <Image
                  src={primaryItemImage}
                  alt={order.items[0]?.productTitre || "Produit commandé"}
                  fill
                  className="object-cover"
                  unoptimized={primaryItemImage.startsWith("/")}
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                  Image principale
                </p>
                <p className="font-medium text-sm sm:text-base line-clamp-2">
                  {order.items.find((item) => item.imageCover)?.productTitre || order.items[0]?.productTitre}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {order.items.length} article{order.items.length > 1 ? "s" : ""} dans cette commande
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> Client
              </p>
              <p className="font-medium">{order.nom}</p>
              <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <a href={`mailto:${order.email}`} className="hover:text-blue-600 break-all">
                  {order.email}
                </a>
              </p>
              {order.telephone && (
                <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhoneInternational(order.telephone)}
                </p>
              )}
              {order.User?.name && (
                <p className="text-xs text-blue-600">Compte adhérent : {order.User.name}</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Livraison
              </p>
              <p className="text-sm whitespace-pre-line">{order.adresseLivraison}</p>
              <p className="text-sm text-muted-foreground">
                {[order.codePostal, order.ville].filter(Boolean).join(" ")}
                {order.pays ? ` — ${order.pays}` : ""}
              </p>
              {order.referenceSuivi && (
                <p className="text-sm flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-indigo-600" />
                  Suivi : <span className="font-mono">{order.referenceSuivi}</span>
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-2 text-sm font-semibold text-blue-800 dark:text-blue-200">
              Articles commandés
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {order.items.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  {renderItemThumbnail(item.imageCover, item.productTitre)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{item.productTitre}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.taille} / {item.couleur} × {item.quantite}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">{formatMerchPrice(item.sousTotal)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMerchPrice(item.prixUnitaire)} / unité
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 flex justify-between font-bold text-blue-700 dark:text-blue-300">
              <span>Total</span>
              <span>{formatMerchPrice(order.montantTotal)}</span>
            </div>
          </div>

          {order.notes && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-3">
              <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-200 mb-1">
                Note du client
              </p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historique</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
              <p>Créée : {formatDate(order.createdAt)}</p>
              <p>Email confirmation : {order.confirmationEmailSentAt ? formatDate(order.confirmationEmailSentAt) : "Non envoyé"}</p>
              <p>Expédition : {formatDate(order.dateExpedition)}</p>
              <p>Clôture : {formatDate(order.dateCloture)}</p>
            </div>
            {order.confirmationEmailError && (
              <p className="text-xs text-red-600">Erreur email : {order.confirmationEmailError}</p>
            )}
          </div>

          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20 p-4 space-y-4">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Suivi administrateur
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving || order.statut === "Confirmee"}
                onClick={() => applyQuickAction("Confirmee")}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Confirmer
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving || order.statutPaiement === "Recu"}
                onClick={() => applyQuickAction(order.statut, "Recu")}
              >
                Paiement reçu
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving || order.statut === "Expediee"}
                onClick={() => applyQuickAction("Expediee")}
              >
                <Truck className="h-3.5 w-3.5 mr-1" />
                Expédier
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-green-300 hover:bg-green-50"
                disabled={saving || order.statut === "Livree"}
                onClick={() => applyQuickAction("Livree", "Recu")}
              >
                Livrer et clôturer
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-red-300 hover:bg-red-50 text-red-600"
                disabled={saving || order.statut === "Annulee"}
                onClick={() => applyQuickAction("Annulee")}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Annuler
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Statut commande</Label>
                <Select value={statut} onValueChange={setStatut}>
                  <SelectTrigger className="mt-1 bg-white dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {MERCH_ORDER_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut paiement</Label>
                <Select value={statutPaiement} onValueChange={setStatutPaiement}>
                  <SelectTrigger className="mt-1 bg-white dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {MERCH_PAYMENT_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Référence de suivi colis</Label>
              <Input
                value={referenceSuivi}
                onChange={(e) => setReferenceSuivi(e.target.value)}
                placeholder="Numéro de suivi transporteur"
                className="mt-1 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <Label>Notes internes (admin)</Label>
              <Textarea
                value={notesAdmin}
                onChange={(e) => setNotesAdmin(e.target.value)}
                rows={3}
                placeholder="Commentaires visibles uniquement par l'équipe admin..."
                className="mt-1 bg-white dark:bg-slate-900"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Enregistrer le suivi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
