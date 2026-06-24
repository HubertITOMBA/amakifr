"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Loader2,
  Package,
  Truck,
  MapPin,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { getPublicMerchOrderByToken } from "@/actions/boutique";
import {
  formatMerchPrice,
  MERCH_ORDER_STATUS_LABELS,
  MERCH_PAYMENT_STATUS_LABELS,
  getMerchOrderStatusBadgeClass,
  getMerchPaymentStatusBadgeClass,
} from "@/lib/boutique";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Page publique de suivi d'une commande boutique (lien reçu par email)
 */
export default function BoutiqueSuiviPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<any | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Lien de suivi invalide");
      setLoading(false);
      return;
    }

    (async () => {
      const res = await getPublicMerchOrderByToken(token);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        setError(res.error || "Commande introuvable");
      }
      setLoading(false);
    })();
  }, [token]);

  const formatDate = (value?: string | Date | null) =>
    value ? format(new Date(value), "dd MMMM yyyy à HH:mm", { locale: fr }) : "—";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-2">
          <Package className="h-7 w-7 text-blue-600" />
          Suivi de commande
        </h1>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <Card className="border-red-200">
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">{error}</p>
              <Link href="/boutique">
                <Button>Retour à la boutique</Button>
              </Link>
            </CardContent>
          </Card>
        ) : order ? (
          <div className="space-y-6">
            <Card className="border-blue-200 shadow-md">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                <CardTitle className="text-lg sm:text-xl">{order.numeroCommande}</CardTitle>
                <p className="text-blue-100 text-sm">Commande passée le {formatDate(order.createdAt)}</p>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className={getMerchOrderStatusBadgeClass(order.statut)}>
                    {MERCH_ORDER_STATUS_LABELS[order.statut] || order.statut}
                  </Badge>
                  <Badge className={getMerchPaymentStatusBadgeClass(order.statutPaiement || "EnAttente")}>
                    {MERCH_PAYMENT_STATUS_LABELS[order.statutPaiement || "EnAttente"]}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Dernière mise à jour</p>
                      <p className="text-muted-foreground">{formatDate(order.updatedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Truck className="h-4 w-4 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Expédition</p>
                      <p className="text-muted-foreground">{formatDate(order.dateExpedition)}</p>
                      {order.referenceSuivi && (
                        <p className="text-xs font-mono mt-1">Suivi : {order.referenceSuivi}</p>
                      )}
                    </div>
                  </div>
                </div>

                {order.dateCloture && (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    Commande clôturée le {formatDate(order.dateCloture)}
                  </p>
                )}

                <div className="flex items-start gap-2 text-sm border-t pt-4">
                  <MapPin className="h-4 w-4 text-slate-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Livraison</p>
                    <p className="text-muted-foreground whitespace-pre-line">{order.adresseLivraison}</p>
                    <p className="text-muted-foreground">
                      {[order.codePostal, order.ville].filter(Boolean).join(" ")}
                      {order.pays ? ` — ${order.pays}` : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Articles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 border-b last:border-0 pb-3 last:pb-0">
                    <div className="relative h-14 w-14 rounded-md overflow-hidden bg-slate-100 shrink-0">
                      {item.imageCover ? (
                        <Image
                          src={item.imageCover}
                          alt={item.productTitre}
                          fill
                          className="object-cover"
                          unoptimized={item.imageCover.startsWith("/")}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ShoppingBag className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.productTitre}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.taille} / {item.couleur} × {item.quantite}
                      </p>
                    </div>
                    <p className="font-semibold text-blue-700">{formatMerchPrice(item.sousTotal)}</p>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span className="text-blue-600">{formatMerchPrice(order.montantTotal)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="text-center">
              <Link href="/boutique">
                <Button variant="outline" className="border-blue-300">
                  Continuer mes achats
                </Button>
              </Link>
            </div>
          </div>
        ) : null}
      </div>
      <Footer />
    </div>
  );
}
