"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingBag, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";
import { useMerchCart } from "@/components/boutique/MerchCartProvider";
import { createMerchOrder, getMerchCheckoutPrefill } from "@/actions/boutique";
import { formatMerchPrice } from "@/lib/boutique";

/**
 * Page panier et validation de commande
 */
export default function BoutiquePanierPage() {
  const { items, total, updateQuantity, removeItem, clearCart } = useMerchCart();
  const [submitting, setSubmitting] = useState(false);
  const [orderDone, setOrderDone] = useState<{
    numeroCommande: string;
    emailSent: boolean;
    suiviToken?: string;
  } | null>(null);

  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresseLivraison, setAdresseLivraison] = useState("");
  const [ville, setVille] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [pays, setPays] = useState("France");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      const res = await getMerchCheckoutPrefill();
      if (res.success && res.data) {
        setEmail(res.data.email);
        setNom(res.data.nom);
        setTelephone(res.data.telephone);
        setAdresseLivraison(res.data.adresseLivraison);
        setVille(res.data.ville);
        setCodePostal(res.data.codePostal);
        setPays(res.data.pays || "France");
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.warning("Votre panier est vide");
      return;
    }
    setSubmitting(true);
    const res = await createMerchOrder({
      items: items.map((i) => ({ variantId: i.variantId, quantite: i.quantite })),
      email,
      nom,
      telephone: telephone || null,
      adresseLivraison,
      ville: ville || null,
      codePostal: codePostal || null,
      pays: pays || null,
      notes: notes || null,
    });
    setSubmitting(false);

    if (res.success && res.data) {
      if (res.data.emailSent) {
        toast.success(res.message);
      } else {
        toast.warning(
          res.message ||
            "Commande enregistrée, mais l'email de confirmation n'a pas pu être envoyé. Conservez votre lien de suivi."
        );
      }
      setOrderDone({
        numeroCommande: res.data.numeroCommande,
        emailSent: res.data.emailSent,
        suiviToken: res.data.suiviToken,
      });
      clearCart();
    } else {
      toast.error(res.error || "Erreur lors de la commande");
    }
  };

  if (orderDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <DynamicNavbar />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Commande enregistrée</h1>
          <p className="text-muted-foreground mb-4">
            Numéro : <strong>{orderDone.numeroCommande}</strong>
          </p>
          {orderDone.emailSent ? (
            <p className="text-sm text-muted-foreground mb-4">
              Un email de confirmation avec le lien de suivi vous a été envoyé.
            </p>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
              L&apos;email de confirmation n&apos;a pas pu être envoyé. Utilisez le lien ci-dessous pour suivre votre commande.
            </p>
          )}
          {orderDone.suiviToken && (
            <Link href={`/boutique/suivi/${orderDone.suiviToken}`} className="block mb-6">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Suivre ma commande
              </Button>
            </Link>
          )}
          <Link href="/boutique"><Button variant="outline">Retour à la boutique</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <ShoppingBag className="h-6 w-6 text-blue-600" />
          Mon panier
        </h1>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Votre panier est vide</p>
              <Link href="/boutique"><Button>Découvrir la boutique</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
              {items.map((item) => (
                <Card key={item.variantId}>
                  <CardContent className="p-4 flex gap-3">
                    <div className="relative h-16 w-16 rounded bg-slate-100 shrink-0 overflow-hidden">
                      {item.imageCover ? (
                        <Image src={item.imageCover} alt="" fill className="object-cover" unoptimized={item.imageCover?.startsWith("/")} />
                      ) : (
                        <ShoppingBag className="h-6 w-6 m-auto text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.productTitre}</p>
                      <p className="text-xs text-muted-foreground">{item.taille} / {item.couleur}</p>
                      <p className="text-sm font-semibold text-blue-600 mt-1">
                        {formatMerchPrice(item.prix * item.quantite)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={item.quantite}
                          onChange={(e) => updateQuantity(item.variantId, parseInt(e.target.value, 10) || 1)}
                          className="w-16 h-8 text-sm"
                        />
                        <Button variant="ghost" size="sm" onClick={() => removeItem(item.variantId)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <p className="text-right text-lg font-bold">Total : {formatMerchPrice(total)}</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Coordonnées de livraison</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Nom complet *</Label>
                    <Input required value={nom} onChange={(e) => setNom(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+33 6 12 34 56 78" className="mt-1" />
                  </div>
                  <div>
                    <Label>Adresse de livraison *</Label>
                    <Textarea required value={adresseLivraison} onChange={(e) => setAdresseLivraison(e.target.value)} rows={2} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Code postal</Label>
                      <Input value={codePostal} onChange={(e) => setCodePostal(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Ville</Label>
                      <Input value={ville} onChange={(e) => setVille(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label>Pays</Label>
                    <Input value={pays} onChange={(e) => setPays(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Notes (optionnel)</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1" />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Confirmer la commande — {formatMerchPrice(total)}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
