"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShoppingBag, ShoppingCart, Minus, Plus } from "lucide-react";
import { toast } from "react-toastify";
import { getPublicMerchProductBySlug } from "@/actions/boutique";
import { formatMerchPrice } from "@/lib/boutique";
import { useMerchCart } from "@/components/boutique/MerchCartProvider";

/**
 * Page produit style e-commerce
 */
export default function BoutiqueProductPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { addItem, itemCount } = useMerchCart();

  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [taille, setTaille] = useState("");
  const [couleur, setCouleur] = useState("");
  const [quantite, setQuantite] = useState(1);

  useEffect(() => {
    (async () => {
      const res = await getPublicMerchProductBySlug(slug);
      if (res.success && res.data) {
        setProduct(res.data);
        const cover = res.data.imageCover || res.data.images?.[0]?.chemin || null;
        setSelectedImage(cover);
        const variants = res.data.variants || [];
        if (variants.length > 0) {
          setTaille(variants[0].taille);
          setCouleur(variants[0].couleur);
        }
      }
      setLoading(false);
    })();
  }, [slug]);

  const tailles = useMemo(
    () => [...new Set(product?.variants?.map((v: any) => v.taille) || [])],
    [product]
  );

  const couleurs = useMemo(
    () =>
      [
        ...new Set(
          product?.variants
            ?.filter((v: any) => !taille || v.taille === taille)
            .map((v: any) => v.couleur) || []
        ),
      ],
    [product, taille]
  );

  const selectedVariant = useMemo(() => {
    return product?.variants?.find(
      (v: any) => v.taille === taille && v.couleur === couleur && v.actif
    );
  }, [product, taille, couleur]);

  const handleAddToCart = () => {
    if (!selectedVariant || !product) {
      toast.warning("Sélectionnez une taille et une couleur disponibles");
      return;
    }
    if (selectedVariant.stock < quantite) {
      toast.error("Stock insuffisant");
      return;
    }
    addItem(
      {
        variantId: selectedVariant.id,
        productId: product.id,
        productTitre: product.titre,
        productSlug: product.slug,
        imageCover: product.imageCover || product.images?.[0]?.chemin,
        taille: selectedVariant.taille,
        couleur: selectedVariant.couleur,
        prix: Number(selectedVariant.prix),
      },
      quantite
    );
    toast.success("Ajouté au panier");
  };

  const handleOrderNow = () => {
    handleAddToCart();
    router.push("/boutique/panier");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p>Produit introuvable</p>
        <Link href="/boutique"><Button>Retour boutique</Button></Link>
      </div>
    );
  }

  const images = product.images?.length
    ? product.images
    : product.imageCover
      ? [{ chemin: product.imageCover }]
      : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-6">
          <Link href="/boutique" className="text-sm text-blue-600 hover:underline">
            ← Retour à la boutique
          </Link>
          <Link href="/boutique/panier">
            <Button variant="outline" size="sm">Panier ({itemCount})</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-blue-200">
              {selectedImage ? (
                <Image src={selectedImage} alt={product.titre} fill className="object-cover" priority />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <ShoppingBag className="h-16 w-16 text-slate-300" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {images.map((img: any, i: number) => (
                  <button
                    key={img.id || i}
                    type="button"
                    onClick={() => setSelectedImage(img.chemin)}
                    className={`relative h-16 w-16 rounded border-2 shrink-0 overflow-hidden ${
                      selectedImage === img.chemin ? "border-blue-600" : "border-transparent"
                    }`}
                  >
                    <Image src={img.chemin} alt="" fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <Card className="border-blue-200 shadow-lg">
            <CardContent className="p-6 space-y-5">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{product.titre}</h1>
                {selectedVariant && (
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    {formatMerchPrice(Number(selectedVariant.prix))}
                  </p>
                )}
              </div>

              {product.description && (
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              )}

              <div className="space-y-3">
                <div>
                  <Label>Taille</Label>
                  <Select value={taille} onValueChange={setTaille}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir une taille" /></SelectTrigger>
                    <SelectContent>
                      {tailles.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Couleur</Label>
                  <Select value={couleur} onValueChange={setCouleur}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir une couleur" /></SelectTrigger>
                    <SelectContent>
                      {couleurs.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantité</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Button type="button" variant="outline" size="icon" onClick={() => setQuantite(Math.max(1, quantite - 1))}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={selectedVariant?.stock || 99}
                      value={quantite}
                      onChange={(e) => setQuantite(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 text-center"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => setQuantite(quantite + 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    {selectedVariant && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {selectedVariant.stock} en stock
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={handleAddToCart}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Ajouter au panier
                </Button>
                <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleOrderNow}>
                  Commander
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
