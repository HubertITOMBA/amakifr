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
import { createPaymentSession } from "@/actions/paiements/create-payment-session";
import { createPaiement, uploadJustificatifPaiement } from "@/actions/paiements";
import { toast } from "sonner";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{
    montant: number;
    montantMax?: number;
    type: string;
    itemId?: string;
    description?: string;
  } | null>(null);
  const [virementJustificatifFile, setVirementJustificatifFile] = useState<File | null>(null);
  const [showVirementForm, setShowVirementForm] = useState(false);
  const [loadingVirement, setLoadingVirement] = useState(false);

  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const adherentId = searchParams.get("adherentId");
  const montant = searchParams.get("montant");

  const canPayByVirement =
    !!adherentId &&
    !!paymentInfo &&
    !!id &&
    ["cotisation-mensuelle", "assistance", "dette-initiale", "obligation"].includes(paymentInfo.type);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.push("/auth/sign-in?callbackUrl=" + encodeURIComponent(window.location.href));
      return;
    }

    // Charger les informations de paiement selon le type
    // Pour les paiements "general", l'id n'est pas requis
    if (type && adherentId && montant && (type === "general" || id)) {
      loadPaymentInfo();
    } else {
      toast.error("Paramètres de paiement manquants");
      router.push("/");
    }
  }, [status, type, id, adherentId, montant]);

  const loadPaymentInfo = async () => {
    // Cette fonction chargera les détails selon le type
    // Pour l'instant, on utilise les paramètres de l'URL
    const montantInitial = parseFloat(montant || "0");
    setPaymentInfo({
      montant: montantInitial,
      montantMax: montantInitial, // Le montant maximum est le montant initial (reste à payer)
      type: type || "",
      itemId: id || undefined,
      description: getPaymentDescription(type || "", id || ""),
    });
    setCustomAmount(montantInitial.toFixed(2));
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
      case "general":
        return "Paiement général - Total des cotisations du mois";
      default:
        return "Paiement";
    }
  };

  const handleStripePayment = async () => {
    if (!paymentInfo || !adherentId) {
      toast.error("Informations de paiement incomplètes");
      return;
    }

    // Déterminer le montant à payer (personnalisé ou prévu)
    const montantAPayer = useCustomAmount 
      ? parseFloat(customAmount.replace(",", "."))
      : paymentInfo.montant;

    // Valider le montant
    if (isNaN(montantAPayer) || montantAPayer <= 0) {
      toast.error("Le montant doit être supérieur à 0");
      return;
    }

    if (paymentInfo.montantMax && montantAPayer > paymentInfo.montantMax) {
      toast.error(`Le montant ne peut pas dépasser ${paymentInfo.montantMax.toFixed(2)} €`);
      return;
    }

    setLoading(true);
    try {
      const result = await createPaymentSession({
        montant: montantAPayer,
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

  const handleVirementPayment = async () => {
    if (!paymentInfo || !adherentId) {
      toast.error("Informations de paiement incomplètes");
      return;
    }
    const montantAPayer = useCustomAmount
      ? parseFloat(customAmount.replace(",", "."))
      : paymentInfo.montant;
    if (isNaN(montantAPayer) || montantAPayer <= 0) {
      toast.error("Le montant doit être supérieur à 0");
      return;
    }
    if (paymentInfo.montantMax && montantAPayer > paymentInfo.montantMax) {
      toast.error(`Le montant ne peut pas dépasser ${paymentInfo.montantMax.toFixed(2)} €`);
      return;
    }
    if (!virementJustificatifFile?.size) {
      toast.error("Un justificatif (preuve de virement) est obligatoire. Parcourez pour sélectionner un document (PDF ou image).");
      return;
    }
    setLoadingVirement(true);
    try {
      const formData = new FormData();
      formData.set("file", virementJustificatifFile);
      const uploadRes = await uploadJustificatifPaiement(formData);
      if (!uploadRes?.success || !uploadRes.data?.chemin) {
        toast.error(uploadRes?.error ?? "Erreur lors du téléversement du justificatif.");
        setLoadingVirement(false);
        return;
      }
      const payload: Parameters<typeof createPaiement>[0] = {
        adherentId,
        montant: montantAPayer,
        datePaiement: new Date().toISOString().split("T")[0],
        moyenPaiement: "Virement",
        description: paymentInfo.description,
        justificatifChemin: uploadRes.data.chemin,
      };
      if (paymentInfo.type === "cotisation-mensuelle" && id) payload.cotisationMensuelleId = id;
      else if (paymentInfo.type === "assistance" && id) payload.assistanceId = id;
      else if (paymentInfo.type === "dette-initiale" && id) payload.detteInitialeId = id;
      else if (paymentInfo.type === "obligation" && id) payload.obligationCotisationId = id;
      const result = await createPaiement(payload);
      if (result.success) {
        toast.success(result.message ?? "Paiement par virement enregistré. Il sera validé après vérification.");
        setShowVirementForm(false);
        setVirementJustificatifFile(null);
        await updateSession();
        await new Promise((r) => setTimeout(r, 200));
        router.push("/user/profile?section=cotisations");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    } catch (e) {
      console.error(e);
      toast.error("Une erreur est survenue");
    } finally {
      setLoadingVirement(false);
    }
  };

  if (status === "loading" || !paymentInfo) {
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
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                    Montant à payer
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Euro className="h-5 w-5 sm:h-6 sm:w-6" />
                    {useCustomAmount 
                      ? parseFloat(customAmount.replace(",", ".") || "0").toFixed(2)
                      : paymentInfo.montant.toFixed(2)
                    }
                  </span>
                </div>
                
                {/* Option pour payer un montant personnalisé */}
                <div className="space-y-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="useCustomAmount"
                      checked={useCustomAmount}
                      onChange={(e) => {
                        setUseCustomAmount(e.target.checked);
                        if (!e.target.checked) {
                          setCustomAmount(paymentInfo.montant.toFixed(2));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Label 
                      htmlFor="useCustomAmount" 
                      className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      Payer un montant personnalisé (paiement en plusieurs fois)
                    </Label>
                  </div>
                  
                  {useCustomAmount && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="customAmount" className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          Montant :
                        </Label>
                        <div className="flex items-center gap-1 flex-1">
                          <Euro className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <Input
                            id="customAmount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={paymentInfo.montantMax || paymentInfo.montant}
                            value={customAmount}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Permettre la saisie avec virgule ou point
                              const normalizedValue = value.replace(",", ".");
                              setCustomAmount(value);
                            }}
                            onBlur={(e) => {
                              const value = parseFloat(e.target.value.replace(",", "."));
                              if (isNaN(value) || value <= 0) {
                                setCustomAmount(paymentInfo.montant.toFixed(2));
                                toast.error("Montant invalide");
                              } else if (paymentInfo.montantMax && value > paymentInfo.montantMax) {
                                setCustomAmount(paymentInfo.montantMax.toFixed(2));
                                toast.error(`Le montant maximum est ${paymentInfo.montantMax.toFixed(2)} €`);
                              } else {
                                setCustomAmount(value.toFixed(2));
                              }
                            }}
                            placeholder={paymentInfo.montant.toFixed(2)}
                            className="h-8 sm:h-9 text-sm"
                          />
                        </div>
                      </div>
                      {paymentInfo.montantMax && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Montant maximum : {paymentInfo.montantMax.toFixed(2)} €
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
                        {useCustomAmount && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                            Montant : {parseFloat(customAmount.replace(",", ".") || "0").toFixed(2)} €
                          </p>
                        )}
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
                        <>
                          <Euro className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Payer
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Virement bancaire */}
              <Card className={`border-2 !py-0 ${canPayByVirement ? "border-green-200 dark:border-green-800" : "border-gray-200 dark:border-gray-700"}`}>
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
                          {canPayByVirement
                            ? "Joignez une preuve de virement (capture d&apos;écran ou reçu) pour enregistrer votre paiement."
                            : "Disponible uniquement pour un élément précis (cotisation, assistance, dette, obligation)."}
                        </p>
                      </div>
                    </div>
                    {canPayByVirement && !showVirementForm && (
                      <Button
                        variant="outline"
                        className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4 shrink-0 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
                        onClick={() => setShowVirementForm(true)}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        Joindre un justificatif
                      </Button>
                    )}
                    {canPayByVirement && showVirementForm && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          setShowVirementForm(false);
                          setVirementJustificatifFile(null);
                        }}
                      >
                        Réduire
                      </Button>
                    )}
                    {!canPayByVirement && (
                      <Button variant="outline" disabled className="h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4 shrink-0">
                        Non disponible
                      </Button>
                    )}
                  </div>
                  {canPayByVirement && showVirementForm && (
                    <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 rounded-lg bg-green-50/50 dark:bg-green-950/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Justificatif (preuve de virement) *
                        </Label>
                      </div>
                      <p className="text-xs text-green-800 dark:text-green-200 flex items-center gap-1.5">
                        <Upload className="h-3.5 w-3.5 shrink-0" />
                        Parcourir pour sélectionner un fichier (PDF ou image)
                      </p>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp"
                        onChange={(e) => setVirementJustificatifFile(e.target.files?.[0] ?? null)}
                        className="bg-white dark:bg-gray-800 text-sm"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">PDF, JPG, PNG, GIF ou WEBP — max 10 Mo</p>
                      <Button
                        onClick={handleVirementPayment}
                        disabled={loadingVirement || !virementJustificatifFile?.size}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                      >
                        {loadingVirement ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                            Enregistrement…
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-1.5" />
                            Enregistrer le paiement par virement
                          </>
                        )}
                      </Button>
                    </div>
                  )}
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
              <Button 
                variant="outline" 
                className="w-full h-8 sm:h-9 text-xs sm:text-sm"
                onClick={async () => {
                  // Mettre à jour la session avant la navigation pour éviter les problèmes de reconnexion
                  await updateSession();
                  // Attendre un peu pour que la session soit propagée
                  await new Promise(resolve => setTimeout(resolve, 200));
                  // Naviguer vers la page avec revalidation
                  router.push("/user/profile?section=cotisations");
                  router.refresh();
                }}
              >
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5" />
                Retour à Mes cotisations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
