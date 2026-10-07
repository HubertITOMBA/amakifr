"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Écran post-confirmation email : attente de validation administrative.
 * Email confirmé ≠ compte actif — aucune promesse d'accès membre.
 */
export default function OnboardingPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-2xl"
            >
                <Card className="shadow-xl border-blue-200 dark:border-blue-800">
                    <CardHeader className="text-center pb-8 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                        <div className="flex justify-center mb-4">
                            <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm">
                                <CheckCircle className="h-12 w-12 text-white" />
                            </div>
                        </div>
                        <CardTitle className="text-3xl font-bold text-white">
                            Email confirmé
                        </CardTitle>
                        <CardDescription className="text-blue-100 text-lg mt-2">
                            Validation administrative en attente
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-8 space-y-6">
                        <div className="text-center space-y-4">
                            <p className="text-gray-600 dark:text-gray-400 text-base sm:text-lg">
                                Votre adresse e-mail est confirmée. Votre adhésion doit maintenant être validée par un administrateur.
                            </p>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                                Vous recevrez un e-mail dès que votre compte aura été activé. Vous pourrez ensuite vous connecter et accéder à votre espace membre.
                            </p>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                                <Mail className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                    En attente d&apos;activation
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    La connexion et l&apos;accès à l&apos;espace membre seront disponibles uniquement après activation par un administrateur.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <Button
                                onClick={() => router.push("/")}
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                                size="lg"
                            >
                                Retour à l&apos;accueil
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
