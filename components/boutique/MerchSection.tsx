"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ShoppingBag, ArrowRight, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicMerchProducts } from "@/actions/boutique";
import { formatMerchPrice } from "@/lib/boutique";

const HERO_IMAGE = "/prod_derive.jpeg";

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
 * Section produits dérivés sur la page d'accueil — visible par tous les visiteurs
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

  return (
    <section className="py-20 bg-gradient-to-br from-white via-blue-50/40 to-indigo-50/40 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-0 w-72 h-72 bg-blue-300/10 dark:bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-300/10 dark:bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400/30 dark:via-blue-600/15 to-transparent opacity-40" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center mb-14"
        >
          <div className="relative order-2 lg:order-1">
            <div className="absolute -inset-3 bg-gradient-to-br from-blue-400/20 via-indigo-400/20 to-purple-400/20 rounded-3xl blur-xl" />
            <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-blue-200/60 dark:border-blue-800/60 bg-black">
              <Image
                src={HERO_IMAGE}
                alt="Produits dérivés AMAKI France — casquettes et chapeaux"
                width={800}
                height={600}
                className="w-full h-auto object-cover"
                priority={false}
              />
            </div>
            <div className="absolute -bottom-4 -right-4 hidden sm:flex items-center gap-2 bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 border border-blue-200 dark:border-blue-800">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Articles officiels AMAKI</span>
            </div>
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-medium">
              <Heart className="h-4 w-4" />
              Soutenez notre association
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight">
              Achetez nos produits dérivés et financez nos actions
            </h2>

            <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
              Chaque achat contribue directement au financement des activités de l&apos;amicale :
              événements, entraide entre membres, projets solidaires et vie associative.
            </p>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Casquettes, chapeaux et autres articles aux couleurs d&apos;AMAKI France —
              disponibles pour tous, adhérents comme visiteurs.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/boutique">
                <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 shadow-md">
                  <ShoppingBag className="h-5 w-5 mr-2" />
                  Découvrir la boutique
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : products.length > 0 ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-8"
            >
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Nos articles en vente
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Parcourez une sélection de nos produits dérivés et commandez en quelques clics.
              </p>
            </motion.div>

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
                    <Card className="overflow-hidden hover:shadow-lg transition-all border-blue-200 dark:border-blue-800 h-full group">
                      <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                        {product.imageCover ? (
                          <Image
                            src={product.imageCover}
                            alt={product.titre}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            unoptimized={product.imageCover.startsWith("/")}
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

            <div className="text-center mt-10">
              <Link href="/boutique">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Voir toute la boutique
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center py-8 px-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
          >
            <ShoppingBag className="h-10 w-10 text-blue-500 mx-auto mb-3" />
            <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
              La boutique s&apos;enrichit prochainement
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Revenez bientôt pour découvrir nos nouveaux articles officiels.
            </p>
            <Link href="/boutique">
              <Button variant="outline" className="border-blue-300">
                Accéder à la boutique
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}
