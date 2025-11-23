"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  ArrowLeft, 
  Shield, 
  CheckCircle2, 
  Loader2,
  Euro,
  Lock,
  AlertCircle
} from "lucide-react";
import { createStripeCheckoutSession } from "@/actions/paiements/stripe";
import { toast } from "sonner";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{
    montant: number;
    type: string;
    itemId?: string;
    description?: string;
  } | null>(null);

  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const adherentId = searchParams.get("adherentId");
  const montant = searchParams.get("montant");

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/auth/sign-in?callbackUrl=" + encodeURIComponent(window.location.href));
      return;
    }

    // Charger les informations de paiement selon le type
    if (type && id && adherentId && montant) {
      loadPaymentInfo();
    } else {
      toast.error("Paramètres de paiement manquants");
      router.push("/");
    }
  }, [status, type, id, adherentId, montant]);

  const loadPaymentInfo = async () => {
    // Cette fonction chargera les détails selon le type
    // Pour l'instant, on utilise les paramètres de l'URL
    setPaymentInfo({
      montant: parseFloat(montant || "0"),
      type: type || "",
      itemId: id || undefined,
      description: getPaymentDescription(type || "", id || ""),
    });
  };

  const getPaymentDescription = (type: string, itemId: string): string => {
    switch (type) {
      case "cotisation-mensuelle":
        return "Cotisation mensuelle";
      case "assistance":
        return "Assistance";
      case "dette-initiale":
        return "Dette initiale";
      case "obligation":
        return "Obligation de cotisation";
      case "adhesion":
        return "Frais d'adhésion";
      default:
        return "Paiement";
    }
  };

  const handleStripePayment = async () => {
    if (!paymentInfo || !adherentId) {
      toast.error("Informations de paiement incomplètes");
      return;
    }

    setLoading(true);
    try {
      const result = await createStripeCheckoutSession({
        montant: paymentInfo.montant,
        adherentId: adherentId,
        type: paymentInfo.type as any,
        itemId: paymentInfo.itemId,
        description: paymentInfo.description,
      });

      if (result.success && result.url) {
        // Rediriger vers Stripe Checkout
        window.location.href = result.url;
      } else {
        toast.error(result.error || "Erreur lors de la création de la session de paiement");
        setLoading(false);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Une erreur est survenue");
      setLoading(false);
    }
  };

  if (status === "loading" || !paymentInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <Card className="border-blue-200 dark:border-blue-800 shadow-xl !py-0">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg pb-3 pt-3 px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <CreditCard className="h-5 w-5" />
              Paiement Sécurisé
            </CardTitle>
            <CardDescription className="text-blue-100 text-xs mt-1">
              Choisissez votre méthode de paiement
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Résumé du paiement */}
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  {paymentInfo.description}
                </span>
                <Badge variant="outline" className="bg-white dark:bg-gray-800 text-xs">
                  {paymentInfo.type.replace("-", " ")}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                  Montant à payer
                </span>
                <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Euro className="h-5 w-5 sm:h-6 sm:w-6" />
                  {paymentInfo.montant.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Méthodes de paiement */}
            <div className="space-y-3">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                Méthodes de paiement disponibles
              </h3>

              {/* Stripe (Cartes bancaires) */}
              <Card className="border-2 hover:border-blue-400 transition-colors cursor-pointer !py-0" onClick={handleStripePayment}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">
                          Carte bancaire
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          Visa, Mastercard, American Express
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Sécurisé</Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Google Pay</Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Apple Pay</Badge>
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStripePayment();
                      }}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4 shrink-0"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 animate-spin" />
                          <span className="hidden sm:inline">Chargement...</span>
                        </>
                      ) : (
                        "Payer"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Virement bancaire */}
              <Card className="border-2 border-gray-200 dark:border-gray-700 !py-0">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <Euro className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">
                          Virement bancaire
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          Les coordonnées bancaires vous seront communiquées après validation
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" disabled className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4 shrink-0">
                      Bientôt disponible
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* PayPal - À venir */}
              <Card className="border-2 border-gray-200 dark:border-gray-700 opacity-60 !py-0">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                        <CreditCard className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">
                          PayPal
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          Disponible prochainement
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" disabled className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4 shrink-0">
                      Bientôt disponible
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sécurité */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-2.5">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white mb-1">
                    Paiement sécurisé
                  </h4>
                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
                    Vos données de paiement sont cryptées et sécurisées selon les normes PCI-DSS. 
                    Nous ne stockons jamais vos informations bancaires.
                  </p>
                </div>
              </div>
            </div>

            {/* Bouton retour */}
            <div className="pt-3 border-t">
              <Link href="/user/profile">
                <Button variant="outline" className="w-full h-8 sm:h-9 text-xs sm:text-sm">
                  <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5" />
                  Retour au profil
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
