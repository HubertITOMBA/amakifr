"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Card className="border-orange-200 dark:border-orange-800 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg">
            <div className="flex items-center justify-center mb-4">
              <div className="p-4 bg-white/20 rounded-full">
                <XCircle className="h-12 w-12 text-white" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl sm:text-3xl">
              Paiement Annulé
            </CardTitle>
            <CardDescription className="text-center text-orange-100">
              Votre paiement n'a pas été effectué
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
                Vous avez annulé le processus de paiement. Aucun montant n'a été débité.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Si vous souhaitez effectuer ce paiement plus tard, vous pouvez y accéder depuis votre profil.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/paiement" className="flex-1">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Réessayer le paiement
                  </Button>
                </Link>
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

