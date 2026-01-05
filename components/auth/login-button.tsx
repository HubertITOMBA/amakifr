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
                    <DialogTrigger asChild={true}>
                        {children}
                    </DialogTrigger>
                    <DialogContent className="p-0 w-auto bg-transparent border-none max-w-[95vw] sm:max-w-md backdrop-blur-none">
                        <DialogTitle className="sr-only">Connexion</DialogTitle>
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