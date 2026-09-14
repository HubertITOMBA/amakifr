"use client";

import { useState } from "react";
import Link from "next/link";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Trash2,
  Mail,
  Shield,
  CheckCircle,
  AlertCircle,
  Info,
  Smartphone,
} from "lucide-react";
import { toast } from "react-toastify";
import { submitDataDeletionRequest } from "@/actions/data-deletion";
import {
  SUPPRESSION_DONNEES_APP_SCOPE,
  SUPPRESSION_DONNEES_BRAND,
  SUPPRESSION_DONNEES_CATEGORIES_SUPPRIMEES,
  SUPPRESSION_DONNEES_CONSERVEES,
  SUPPRESSION_DONNEES_DELAI,
  SUPPRESSION_DONNEES_NO_DIRECT_DELETE,
  SUPPRESSION_DONNEES_PROCEDURE,
} from "@/lib/rgpd/suppression-donnees-content";

const pageShell =
  "min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800";

const mainCard =
  "shadow-lg border-blue-200 dark:border-blue-800 overflow-hidden gap-0 rounded-xl";

const gradientHeader =
  "bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white px-5 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 rounded-t-xl";

const successHeader =
  "bg-gradient-to-r from-emerald-500/90 via-emerald-400/80 to-emerald-500/90 dark:from-emerald-700/50 dark:via-emerald-600/40 dark:to-emerald-700/50 text-white px-5 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 rounded-t-xl";

const sectionBlock =
  "rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4 sm:p-5 space-y-3";

const sectionTitle =
  "text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 leading-snug";

/**
 * Page publique Play Store / RGPD — demande de suppression (sans suppression directe).
 */
export default function SuppressionDonneesPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Veuillez entrer une adresse e-mail valide");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("email", email.trim());
      if (message.trim()) {
        formData.append("message", message.trim());
      }

      const result = await submitDataDeletionRequest(formData);

      if (result.success) {
        setIsSubmitted(true);
        toast.success(
          result.message ||
            "Votre demande a été prise en compte. Aucune suppression immédiate n'a eu lieu."
        );
        setEmail("");
        setMessage("");
      } else {
        toast.error(
          result.error || "Une erreur est survenue. Veuillez réessayer."
        );
      }
    } catch {
      toast.error(
        "Une erreur est survenue. Veuillez réessayer ou nous contacter directement."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className={pageShell}>
        <DynamicNavbar />

        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <Card
            className="shadow-lg border-emerald-200 dark:border-emerald-800 overflow-hidden gap-0 rounded-xl"
            data-testid="suppression-confirmation-card"
          >
            <CardHeader
              className={successHeader}
              data-testid="suppression-confirmation-header"
            >
              <div className="flex items-start gap-3">
                <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-0.5" aria-hidden />
                <h1 className="text-white text-2xl sm:text-3xl font-bold leading-snug">
                  Demande reçue
                </h1>
              </div>
            </CardHeader>

            <CardContent className="px-4 sm:px-6 py-5 sm:py-7 space-y-5 bg-white dark:bg-gray-900">
              <Alert
                className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20"
                data-testid="suppression-confirmation-alert"
              >
                <CheckCircle className="h-5 w-5 text-emerald-600" aria-hidden />
                <AlertTitle className="text-emerald-900 dark:text-emerald-100 font-semibold">
                  Demande enregistrée — pas de suppression immédiate
                </AlertTitle>
                <AlertDescription className="text-emerald-800 dark:text-emerald-200 mt-2">
                  Si un compte correspondant existe, votre demande a été prise
                  en compte. {SUPPRESSION_DONNEES_NO_DIRECT_DELETE}
                </AlertDescription>
              </Alert>

              <section className={sectionBlock} aria-labelledby="next-steps-heading">
                <h2
                  id="next-steps-heading"
                  className={sectionTitle}
                >
                  Prochaines étapes
                </h2>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-1 sm:ml-4 text-sm sm:text-base">
                  <li>
                    Vérification de votre identité par l&apos;équipe{" "}
                    {SUPPRESSION_DONNEES_BRAND}
                  </li>
                  <li>E-mail de confirmation à l&apos;adresse du compte</li>
                  <li>
                    Suppression des données éligibles uniquement après
                    validation
                  </li>
                  <li>{SUPPRESSION_DONNEES_DELAI}</li>
                </ul>
              </section>

              <Button
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail("");
                  setMessage("");
                }}
                className="w-full"
                variant="outline"
              >
                Faire une nouvelle demande
              </Button>
            </CardContent>
          </Card>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className={pageShell}>
      <DynamicNavbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Card className={mainCard} data-testid="suppression-main-card">
          <CardHeader
            className={gradientHeader}
            data-testid="suppression-card-header"
          >
            <div className="flex items-start gap-3">
              <Trash2 className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0 space-y-2">
                <h1 className="text-white text-2xl sm:text-3xl font-bold leading-snug">
                  {SUPPRESSION_DONNEES_BRAND} — Suppression des données
                </h1>
                <CardDescription className="text-blue-50 dark:text-blue-100 text-xs sm:text-sm">
                  Demande RGPD pour le site et l&apos;application mobile AMAKI
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 sm:px-6 py-5 sm:py-7 space-y-5 bg-white dark:bg-gray-900">
            {/* Explications */}
            <section
              className="space-y-3"
              aria-label="Explications"
              data-testid="suppression-explications"
            >
              <Alert className="border-blue-200 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-800">
                <Smartphone className="h-5 w-5" aria-hidden />
                <AlertTitle>Application mobile AMAKI</AlertTitle>
                <AlertDescription className="mt-2">
                  {SUPPRESSION_DONNEES_APP_SCOPE}
                </AlertDescription>
              </Alert>

              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                <Shield className="h-5 w-5 text-amber-600" aria-hidden />
                <AlertTitle className="text-amber-900 dark:text-amber-100 font-semibold">
                  Sécurité
                </AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200 mt-2">
                  {SUPPRESSION_DONNEES_NO_DIRECT_DELETE}
                </AlertDescription>
              </Alert>

              <section className={sectionBlock} aria-labelledby="procedure-heading">
                <h2 id="procedure-heading" className={sectionTitle}>
                  Procédure de demande
                </h2>
                <ol className="list-decimal list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-1 sm:ml-2 text-sm sm:text-base">
                  {SUPPRESSION_DONNEES_PROCEDURE.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            </section>

            {/* Données supprimées / conservées */}
            <section
              className="space-y-3"
              aria-label="Données concernées"
              data-testid="suppression-donnees-categories"
            >
              <section
                className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-4 sm:p-5 space-y-3"
                aria-labelledby="deleted-heading"
              >
                <h2 id="deleted-heading" className={sectionTitle}>
                  Catégories de données supprimées
                </h2>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-1 sm:ml-4 text-sm sm:text-base">
                  {SUPPRESSION_DONNEES_CATEGORIES_SUPPRIMEES.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <Alert
                className="border-amber-200 bg-amber-50 dark:bg-amber-900/20"
                data-testid="suppression-donnees-conservees"
              >
                <AlertCircle className="h-5 w-5 text-amber-600" aria-hidden />
                <AlertTitle className="text-amber-900 dark:text-amber-100 font-semibold">
                  Données éventuellement conservées
                </AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200 mt-2">
                  Motifs et durées alignés sur la{" "}
                  <Link
                    href="/confidentialite"
                    className="underline font-semibold text-blue-700 dark:text-blue-300"
                  >
                    politique de confidentialité
                  </Link>
                  :
                  <ul className="list-disc list-inside mt-2 ml-1 sm:ml-4 space-y-1">
                    {SUPPRESSION_DONNEES_CONSERVEES.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>

              <div
                className="p-3 sm:p-4 bg-blue-50/80 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800"
                data-testid="suppression-delai"
              >
                <div className="flex items-start gap-3">
                  <Info
                    className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0"
                    aria-hidden
                  />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {SUPPRESSION_DONNEES_DELAI}
                  </p>
                </div>
              </div>
            </section>

            {/* Formulaire */}
            <section
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4 sm:p-5 space-y-5 shadow-sm"
              aria-labelledby="form-heading"
              data-testid="suppression-formulaire"
            >
              <h2 id="form-heading" className={sectionTitle}>
                Formulaire de demande
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-slate-900 dark:text-slate-100"
                  >
                    Adresse e-mail du compte{" "}
                    <span className="text-red-500" aria-hidden>
                      *
                    </span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="votre.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-required="true"
                    className="w-full min-h-11"
                  />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Seule information strictement nécessaire pour identifier le
                    compte et lancer la vérification. Aucune suppression sans
                    contrôle d&apos;identité.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="message"
                    className="text-slate-900 dark:text-slate-100"
                  >
                    Message (optionnel)
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Précisions utiles pour le traitement de votre demande…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="w-full"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="w-full bg-red-600 hover:bg-red-700 text-white min-h-11"
                  size="lg"
                >
                  {isSubmitting ? (
                    "Envoi en cours…"
                  ) : (
                    <>
                      <Trash2 className="h-5 w-5 mr-2" aria-hidden />
                      Envoyer la demande de suppression
                    </>
                  )}
                </Button>
              </form>
            </section>

            {/* Aide / informations */}
            <section
              className={`${sectionBlock} border-t-0`}
              aria-labelledby="help-heading"
              data-testid="suppression-aide"
            >
              <h2 id="help-heading" className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Besoin d&apos;aide ?
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-3 text-sm sm:text-base">
                Vous pouvez aussi vous connecter sur le site web ou nous écrire
                :
              </p>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Mail className="h-5 w-5 text-blue-600 shrink-0" aria-hidden />
                <a
                  href="mailto:contact@amaki.fr?subject=Demande%20de%20suppression%20de%20donn%C3%A9es"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold break-all"
                >
                  contact@amaki.fr
                </a>
              </div>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                Voir aussi la{" "}
                <Link
                  href="/confidentialite"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  politique de confidentialité
                </Link>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
