"use client";

import { CardWrapper } from "@/components/auth/card-wrapper";
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { LoginButton } from "@/components/auth/login-button";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

export const ErrorCard = () => {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");
    
    // Détecter les erreurs PKCE
    const isPKCEError = error === "Configuration" || 
                       error?.toLowerCase().includes("pkce") ||
                       error?.toLowerCase().includes("code_verifier");
    
    return (
        <CardWrapper  
            labelBox= "Erreur !"
            headerLabel="Oops! Quelque chose s'est mal passée !"  
            backButtonLabel="Retour à la connexion"
            backButtonComponent={
                <LoginButton mode="modal">
                    <Button
                        variant="link"
                        size="sm"
                        type="button"
                        className="w-full text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 font-normal"
                    >
                        Retour à la connexion
                    </Button>
                </LoginButton>
            }
        >
            <div className="w-full space-y-4">
                <div className="flex justify-center items-center">
                    <ExclamationTriangleIcon className="text-destructive h-8 w-8" />
                </div>
                
                {isPKCEError && (
                    <Alert className="bg-blue-50 border-blue-200">
                        <InfoIcon className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-900 font-semibold">
                            Problème de connexion détecté
                        </AlertTitle>
                        <AlertDescription className="text-blue-800 text-sm mt-2">
                            <p className="mb-2">
                                Cette erreur peut survenir si vous êtes connecté depuis plusieurs appareils en même temps.
                            </p>
                            <p className="mb-2 font-semibold">Pour résoudre le problème :</p>
                            <ol className="list-decimal list-inside space-y-1 ml-2">
                                <li>Videz les cookies de votre navigateur pour ce site</li>
                                <li>Fermez et rouvrez votre navigateur</li>
                                <li>Essayez de vous reconnecter</li>
                            </ol>
                            <p className="mt-2 text-xs">
                                Note : L'application supporte plusieurs sessions simultanées. Chaque navigateur/appareil a ses propres cookies isolés.
                            </p>
                        </AlertDescription>
                    </Alert>
                )}
                
                {error && !isPKCEError && (
                    <Alert>
                        <AlertTitle>Code d'erreur : {error}</AlertTitle>
                        <AlertDescription>
                            Si le problème persiste, contactez l'administrateur.
                        </AlertDescription>
                    </Alert>
                )}
            </div>
       </CardWrapper>     
    )
}

