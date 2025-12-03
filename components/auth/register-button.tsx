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
            // Rediriger vers la page d'inscription avec le formulaire intégré
            router.push(`/inscription`);
          }

         if (mode === "modal") {
            return (
                <Dialog>
                    <DialogTrigger asChild={true}>
                        {children}
                    </DialogTrigger>
                    <DialogContent className="p-0 w-auto bg-transparent border-none max-w-md backdrop-blur-none">
                        <DialogTitle className="sr-only">Inscription</DialogTitle>
                        <div className="bg-transparent">
                            <RegisterForm />
                        </div>
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

