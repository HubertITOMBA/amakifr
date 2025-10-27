"use client"

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface LogoutButtonProps {
    children?: React.ReactNode;
};

export const LogoutButton = ({ children }: LogoutButtonProps ) => {
    const router = useRouter();
    
    const onClick = async () => {
        try {
            await signOut({ 
                redirect: false,
                callbackUrl: "/" 
            });
            // Redirection manuelle vers la page d'accueil
            router.push("/");
            // Recharger la page pour s'assurer que l'état est mis à jour
            router.refresh();
        } catch (error) {
            console.error("Erreur lors de la déconnexion:", error);
        }
    };

    return (
        <span onClick={onClick} className="cursor-pointer">
            {children}
        </span>
    )
}