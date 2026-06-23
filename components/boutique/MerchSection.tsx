"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicMerchProducts } from "@/actions/boutique";
import { formatMerchPrice } from "@/lib/boutique";

interface MerchPreview {
  id: string;
  titre: string;
  slug: string;
  description: string | null;
  imageCover: string | null;
  prixMin: number | null;
  enStock: boolean;
}

/**
 * Section produits dérivés sur la page d'accueil
 */
export function MerchSection() {
  const [products, setProducts] = useState<MerchPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await getPublicMerchProducts();
      if (res.success && res.data) setProducts(res.data.slice(0, 6));
      setLoading(false);
    })();
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className="py-16 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <ShoppingBag className="h-4 w-4" />
            Soutenez l&apos;association
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Produits dérivés AMAKI
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Découvrez nos articles officiels et contribuez au financement de nos activités.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/boutique/${product.slug}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-all border-blue-200 dark:border-blue-800 h-full">
                    <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                      {product.imageCover ? (
                        <Image
                          src={product.imageCover}
                          alt={product.titre}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                          <ShoppingBag className="h-12 w-12" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                        {product.titre}
                      </h3>
                      {product.prixMin != null && (
                        <p className="text-blue-600 dark:text-blue-400 font-bold">
                          À partir de {formatMerchPrice(product.prixMin)}
                        </p>
                      )}
                      {!product.enStock && (
                        <p className="text-xs text-red-500 mt-1">Rupture de stock</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        <div className="text-center mt-10">
          <Link href="/boutique">
            <Button className="bg-blue-600 hover:bg-blue-700">
              Voir toute la boutique
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
