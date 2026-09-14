"use client"

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import LoginForm from "@/components/auth/login-form";


interface LoginButtonProps {
    children?: React.ReactNode;
    mode?: "modal" | "redirect";
    asChild?: boolean;
    /** Contrôle externe de la Dialog (ex. ouverture depuis UserButton hors dropdown). */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

/**
 * Bouton de connexion : redirection vers /auth/sign-in, ou Dialog modale.
 *
 * En mode modal, peut être non contrôlé (trigger via children, ex. Hero)
 * ou contrôlé via open/onOpenChange sans trigger (ex. sœur du DropdownMenu avatar).
 */
export const LoginButton = ({
        children,
        mode = "redirect",
        open,
        onOpenChange,
    } : LoginButtonProps) => {

        const pathname = usePathname();

        const getHref = () => {
            const callbackUrl = encodeURIComponent(pathname || "/");
            return `/auth/sign-in?callbackUrl=${callbackUrl}`;
        }

         if (mode === "modal") {
            return (
                <Dialog open={open} onOpenChange={onOpenChange}>
                    {children != null ? (
                        <DialogTrigger asChild={true}>
                            {children}
                        </DialogTrigger>
                    ) : null}
                    <DialogContent
                        onCloseAutoFocus={(e) => e.preventDefault()}
                        className="p-0 w-auto bg-transparent border-none max-w-[95vw] sm:max-w-md backdrop-blur-none"
                    >
                        <DialogTitle className="sr-only">Connexion</DialogTitle>
                        <DialogDescription className="sr-only">
                            Connectez-vous à votre compte AMAKI avec votre adresse e-mail et votre mot de passe.
                        </DialogDescription>
                        <div className="bg-transparent">
                            <LoginForm />
                        </div>
                    </DialogContent>
                </Dialog>
                )        
        }
         
    return (
        <Link href={getHref()} className="cursor-pointer">
            {children}
        </Link>
    )
}
