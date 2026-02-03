"use client"

import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { logDeconnexionActivity } from "@/actions/auth/logout";

interface LogoutButtonProps {
    children?: React.ReactNode;
};

export const LogoutButton = ({ children }: LogoutButtonProps ) => {
    const pathname = usePathname();
    
    const onClick = async () => {
        try {
            const redirectUrl = pathname?.includes("/agenda") ? "/evenements" : "/";
            await logDeconnexionActivity();
            await signOut({
                redirect: true,
                callbackUrl: redirectUrl
            });
            window.location.href = redirectUrl;
        } catch (error) {
            console.error("Erreur lors de la déconnexion:", error);
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