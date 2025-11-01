"use client"

import { useRouter, usePathname } from "next/navigation";
import { 
    Dialog, 
    DialogContent,
    DialogTitle,
    DialogTrigger } from "@/components/ui/dialog"
import { RegisterForm } from "@/components/auth/register-form";


interface RegisterButtonProps {
    children: React.ReactNode;
    mode?: "modal" | "redirect",
    asChild?: boolean;
};


export const RegisterButton = ({
        children,
        mode = "redirect",
        asChild
    } : RegisterButtonProps) => {

        const router = useRouter();
        const pathname = usePathname();

        const onClick = () => {
            // Inclure l'URL actuelle comme callbackUrl pour rediriger après inscription
            const callbackUrl = encodeURIComponent(pathname);
            router.push(`/auth/sign-up?callbackUrl=${callbackUrl}`);
          }

         if (mode === "modal") {
            return (
                <Dialog>
                    <DialogTrigger asChild={asChild}>
                        {children}
                    </DialogTrigger>
                    <DialogContent className="p-0 w-auto bg-transparent border-none max-w-md">
                        <DialogTitle className="sr-only">Inscription</DialogTitle>
                        <RegisterForm />
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

