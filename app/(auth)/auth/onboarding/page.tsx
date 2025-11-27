"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Sparkles, ArrowRight, User, Mail, Calendar } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);

    useEffect(() => {
        // Vérifier si l'utilisateur est connecté et a vérifié son email
        // Sinon, rediriger vers la page de connexion
    }, []);

    const handleContinue = () => {
        if (step === 1) {
            setStep(2);
        } else {
            router.push("/user/profile?onboarding=complete");
        }
    };

    const handleSkip = () => {
        router.push("/");
    };

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
                            Bienvenue dans la communauté !
                        </CardTitle>
                        <CardDescription className="text-blue-100 text-lg mt-2">
                            Votre compte a été créé avec succès
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-8 space-y-6">
                        {step === 1 && (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-6"
                            >
                                <div className="text-center space-y-4">
                                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                                        Félicitations ! 🎉
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Votre email a été vérifié et votre compte est maintenant actif.
                                    </p>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                                            <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                                Accès à votre profil
                                            </h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Vous pouvez maintenant accéder à votre profil et compléter vos informations.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                        <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                                            <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                                Événements et activités
                                            </h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Découvrez les événements à venir et inscrivez-vous pour y participer.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                        <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
                                            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                                Communauté active
                                            </h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Rejoignez des groupes, partagez des annonces et connectez-vous avec d'autres membres.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                    <Button
                                        onClick={handleContinue}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                                        size="lg"
                                    >
                                        Compléter mon profil
                                        <ArrowRight className="ml-2 h-5 w-5" />
                                    </Button>
                                    <Button
                                        onClick={handleSkip}
                                        variant="outline"
                                        className="flex-1"
                                        size="lg"
                                    >
                                        Plus tard
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-6"
                            >
                                <div className="text-center space-y-4">
                                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                                        Complétez votre profil
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Ajoutez des informations pour mieux vous connaître et faciliter les connexions.
                                    </p>
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                            Informations recommandées :
                                        </h4>
                                        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                            <li className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                Photo de profil
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                Année de promotion (si ancien élève)
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                Localisation (pays, ville)
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                Profession
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                Centres d'intérêt
                                            </li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                    <Link href="/user/complete-profile" className="flex-1">
                                        <Button
                                            className="w-full bg-blue-600 hover:bg-blue-700"
                                            size="lg"
                                        >
                                            Compléter mon profil
                                            <ArrowRight className="ml-2 h-5 w-5" />
                                        </Button>
                                    </Link>
                                    <Button
                                        onClick={handleSkip}
                                        variant="outline"
                                        className="flex-1"
                                        size="lg"
                                    >
                                        Plus tard
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}

