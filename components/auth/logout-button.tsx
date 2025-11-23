"use client"

import { signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";

interface LogoutButtonProps {
    children?: React.ReactNode;
};

export const LogoutButton = ({ children }: LogoutButtonProps ) => {
    const router = useRouter();
    const pathname = usePathname();
    
    const onClick = async () => {
        try {
            // Déterminer la page de redirection selon la page actuelle
            // Si on est sur /agenda (privé), rediriger vers /evenements (public)
            // Sinon, rediriger vers la page d'accueil
            const redirectUrl = pathname?.includes("/agenda") ? "/evenements" : "/";
            
            await signOut({ 
                redirect: true,
                callbackUrl: redirectUrl
            });
            
            // Forcer un rechargement complet de la page pour s'assurer que tous les états sont réinitialisés
            // Cela évite les problèmes de cache et de session
            window.location.href = redirectUrl;
        } catch (error) {
            console.error("Erreur lors de la déconnexion:", error);
            // En cas d'erreur, forcer quand même la redirection
            const redirectUrl = pathname?.includes("/agenda") ? "/evenements" : "/";
            window.location.href = redirectUrl;
        }
    };

    return (
        <span onClick={onClick} className="cursor-pointer">
            {children}
        </span>
    )
}