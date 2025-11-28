"use client";

import { useState } from "react";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trash2, Mail, Shield, CheckCircle, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { submitDataDeletionRequest } from "@/actions/data-deletion";

export default function SuppressionDonneesPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast.error("Veuillez entrer une adresse email valide");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("email", email);
      if (message) {
        formData.append("message", message);
      }

      const result = await submitDataDeletionRequest(formData);
      
      if (result.success) {
        setIsSubmitted(true);
        toast.success(result.message || "Votre demande a été envoyée avec succès");
        
        // Réinitialiser le formulaire
        setEmail("");
        setMessage("");
      } else {
        toast.error(result.error || "Une erreur est survenue. Veuillez réessayer.");
      }
    } catch (error) {
      toast.error("Une erreur est survenue. Veuillez réessayer ou nous contacter directement.");
      console.error("Erreur lors de l'envoi de la demande:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Navbar />
        
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="shadow-lg border-green-200">
            <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8" />
                <CardTitle className="text-3xl font-bold">Demande reçue</CardTitle>
              </div>
            </CardHeader>
            
            <CardContent className="p-6 sm:p-8 space-y-6">
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <AlertTitle className="text-green-900 dark:text-green-100 font-semibold">
                  Demande de suppression enregistrée
                </AlertTitle>
                <AlertDescription className="text-green-800 dark:text-green-200 mt-2">
                  Votre demande de suppression de données a été reçue avec succès. 
                  Nous allons traiter votre demande dans les plus brefs délais (généralement sous 30 jours).
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Prochaines étapes
                </h3>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                  <li>Nous allons vérifier votre identité pour des raisons de sécurité</li>
                  <li>Nous vous enverrons un email de confirmation à l'adresse fournie</li>
                  <li>Une fois vérifiée, nous procéderons à la suppression de vos données</li>
                  <li>Vous recevrez une notification une fois la suppression terminée</li>
                </ul>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold mb-1">
                      Important
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Certaines données peuvent être conservées plus longtemps si la loi l'exige 
                      (par exemple, données financières pour les obligations comptables).
                    </p>
                  </div>
                </div>
              </div>

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
        </div>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="shadow-lg border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <Trash2 className="h-8 w-8" />
              <div>
                <CardTitle className="text-3xl font-bold">Demande de Suppression des Données</CardTitle>
                <CardDescription className="text-blue-100 mt-2">
                  Conformément au RGPD, vous pouvez demander la suppression de vos données personnelles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 sm:p-8 space-y-6">
            <Alert>
              <Shield className="h-5 w-5" />
              <AlertTitle>Vos droits</AlertTitle>
              <AlertDescription className="mt-2">
                Conformément au Règlement Général sur la Protection des Données (RGPD), vous avez le droit 
                de demander la suppression de vos données personnelles. Cette page vous permet de faire 
                cette demande de manière simple et sécurisée.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Quelles données seront supprimées ?
              </h3>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                <li>Vos informations de compte (nom, email, téléphone, adresse)</li>
                <li>Votre profil utilisateur et préférences</li>
                <li>Votre historique de connexion</li>
                <li>Vos inscriptions aux événements (sauf si nécessaire pour des raisons légales)</li>
                <li>Vos messages et communications personnelles</li>
              </ul>
            </div>

            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <AlertTitle className="text-amber-900 dark:text-amber-100 font-semibold">
                Données conservées
              </AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200 mt-2">
                Certaines données peuvent être conservées plus longtemps si la loi l'exige :
                <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
                  <li>Données financières et comptables (10 ans)</li>
                  <li>Historique des élections (pour transparence et traçabilité)</li>
                  <li>Logs de sécurité (1 an)</li>
                </ul>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-900 dark:text-slate-100">
                  Adresse email associée à votre compte <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full"
                />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Nous utiliserons cette adresse pour vérifier votre identité et vous confirmer la suppression.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-slate-900 dark:text-slate-100">
                  Message (optionnel)
                </Label>
                <Textarea
                  id="message"
                  placeholder="Vous pouvez ajouter des informations supplémentaires ou des précisions sur votre demande..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full"
                />
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold mb-1">
                      Processus de suppression
                    </p>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside ml-2">
                      <li>Vérification de votre identité (sous 48h)</li>
                      <li>Confirmation par email</li>
                      <li>Suppression des données (sous 30 jours)</li>
                      <li>Notification de confirmation</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !email}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-5 w-5 mr-2" />
                    Envoyer la demande de suppression
                  </>
                )}
              </Button>
            </form>

            <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Besoin d'aide ?
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-3">
                Si vous préférez, vous pouvez également nous contacter directement :
              </p>
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Mail className="h-5 w-5 text-blue-600" />
                <a 
                  href="mailto:asso.amaki@gmail.com?subject=Demande de suppression de données" 
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  asso.amaki@gmail.com
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}

