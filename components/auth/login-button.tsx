"use client"

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
    Dialog, 
    DialogContent,
    DialogTitle,
    DialogTrigger } from "@/components/ui/dialog"
import LoginForm from "@/components/auth/login-form";


interface LoginButtonProps {
    children: React.ReactNode;
    mode?: "modal" | "redirect",
    asChild?: boolean;
};


export const LoginButton = ({
        children,
        mode = "redirect",
        asChild
    } : LoginButtonProps) => {

        const pathname = usePathname();

        // Utiliser Link au lieu de router.push pour éviter les problèmes de navigation
        const getHref = () => {
            const callbackUrl = encodeURIComponent(pathname || "/");
            return `/auth/sign-in?callbackUrl=${callbackUrl}`;
        }

         if (mode === "modal") {
            return (
                <Dialog>
                    <DialogTrigger asChild={asChild}>
                        {children}
                    </DialogTrigger>
                    <DialogContent className="p-0 w-auto bg-transparent border-none">
                        <DialogTitle className="sr-only">Connexion</DialogTitle>
                        <LoginForm />
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