"use client"

import { useRouter, usePathname } from "next/navigation";
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

        const router = useRouter();
        const pathname = usePathname();

        const onClick = () => {
            // Inclure l'URL actuelle comme callbackUrl pour rediriger après connexion
            const callbackUrl = encodeURIComponent(pathname);
            router.push(`/auth/sign-in?callbackUrl=${callbackUrl}`);
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
        <span onClick={onClick} className="cursor-pointer">
            {children}
        </span>
    )
   

}