"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { getPublicMerchProducts } from "@/actions/boutique";
import { formatMerchPrice } from "@/lib/boutique";
import { useMerchCart } from "@/components/boutique/MerchCartProvider";

/**
 * Catalogue public des produits dérivés
 */
export default function BoutiquePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { itemCount } = useMerchCart();

  useEffect(() => {
    (async () => {
      const res = await getPublicMerchProducts();
      if (res.success && res.data) setProducts(res.data);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="h-8 w-8 text-blue-600" />
              Boutique AMAKI
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Produits dérivés pour soutenir l&apos;association
            </p>
          </div>
          <Link href="/boutique/panier">
            <Button variant="outline" className="border-blue-300">
              Panier ({itemCount})
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Aucun produit disponible pour le moment.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <Link key={product.id} href={`/boutique/${product.slug}`}>
                <Card className="overflow-hidden hover:shadow-xl transition-all border-blue-200 h-full">
                  <div className="relative aspect-square bg-slate-100">
                    {product.imageCover ? (
                      <Image src={product.imageCover} alt={product.titre} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <ShoppingBag className="h-12 w-12 text-slate-300" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h2 className="font-semibold text-lg mb-1">{product.titre}</h2>
                    {product.prixMin != null && (
                      <p className="text-blue-600 font-bold">À partir de {formatMerchPrice(product.prixMin)}</p>
                    )}
                    <Button variant="link" className="p-0 h-auto mt-2 text-blue-600">
                      Voir le produit <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
