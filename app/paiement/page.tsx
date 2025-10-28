"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ArrowLeft, Shield, CheckCircle2, AlertCircle } from "lucide-react";

export default function PaymentPlaceholderPage() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const id = searchParams.get("id");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <CreditCard className="h-5 w-5" />
              Page de Paiement (Bientôt disponible)
            </CardTitle>
            <CardDescription>
              Intégration à venir: Stripe, PayPal, et cartes (Visa, MasterCard, American Express)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Vous avez été redirigé ici depuis la table {type === 'cotisation' ? 'des cotisations' : 'des obligations'}.
              </p>
              {id && (
                <p className="text-sm text-gray-500">Référence interne: <span className="font-mono">{id}</span></p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-slate-800 border">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Paiements sécurisés</p>
                  <p className="text-xs text-gray-500">Normes PCI-DSS</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-slate-800 border">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Confirmation instantanée</p>
                  <p className="text-xs text-gray-500">Reçus par e-mail</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-slate-800 border">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium">Support multi-méthodes</p>
                  <p className="text-xs text-gray-500">Stripe & PayPal prochainement</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/user/profile">
                <Button variant="outline" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Retour au profil
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


