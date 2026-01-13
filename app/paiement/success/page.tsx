"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Download, ArrowLeft, Loader2 } from "lucide-react";
import { getStripeSession } from "@/actions/paiements/stripe";
import { generateReceiptPDF } from "@/actions/paiements/receipt";
import { toast } from "sonner";
import Link from "next/link";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [paiementId, setPaiementId] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadPaymentData();
    } else {
      toast.error("Session de paiement introuvable");
      router.push("/");
    }
  }, [sessionId]);

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      const result = await getStripeSession(sessionId!);
      
      if (result.success && result.session) {
        // Récupérer l'ID du paiement depuis les métadonnées ou la base
        const { db } = await import("@/lib/db");
        const paiement = await db.paiementCotisation.findFirst({
          where: { stripeSessionId: sessionId! },
        });

        if (paiement) {
          setPaiementId(paiement.id);
        }

        setPaymentData({
          amount: (result.session.amount_total || 0) / 100,
          currency: result.session.currency,
          customerEmail: result.session.customer_email,
          paymentStatus: result.session.payment_status,
        });
      } else {
        toast.error("Impossible de récupérer les informations de paiement");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!paiementId) {
      toast.error("ID de paiement introuvable");
      return;
    }

    try {
      const result = await generateReceiptPDF(paiementId);
      
      if (result.success && result.receiptUrl) {
        // Ouvrir le PDF dans un nouvel onglet
        window.open(result.receiptUrl, "_blank");
        toast.success("Reçu généré avec succès");
      } else {
        toast.error(result.error || "Erreur lors de la génération du reçu");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Une erreur est survenue lors de la génération du reçu");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <DynamicNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Card className="border-green-200 dark:border-green-800 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 bg-white/20 rounded-full">
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl sm:text-3xl">
              Paiement Réussi !
            </CardTitle>
            <CardDescription className="text-center text-green-100">
              Votre paiement a été traité avec succès
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {paymentData && (
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Montant payé</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {paymentData.amount.toFixed(2)} €
                    </span>
                  </div>
                  {paymentData.customerEmail && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Email</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {paymentData.customerEmail}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Statut</span>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {paymentData.paymentStatus === "paid" ? "Payé" : paymentData.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Un reçu de paiement a été envoyé à votre adresse email.
                Votre paiement sera validé automatiquement et visible dans votre profil sous peu.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleDownloadReceipt}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger le reçu
                </Button>
                <Link href="/user/profile" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour au profil
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

