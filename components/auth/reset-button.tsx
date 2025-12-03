"use client"

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { 
    Dialog, 
    DialogContent,
    DialogTitle,
    DialogTrigger } from "@/components/ui/dialog"
import { ResetForm } from "@/components/auth/reset-form";


interface ResetButtonProps {
    children: React.ReactNode;
    mode?: "modal" | "redirect",
    asChild?: boolean;
};


export const ResetButton = ({
        children,
        mode = "redirect",
        asChild
    } : ResetButtonProps) => {

        const router = useRouter();
        const pathname = usePathname();

        // Utiliser Link au lieu de router.push pour éviter les problèmes de navigation
        const getHref = () => {
            return `/auth/reset`;
        }

         if (mode === "modal") {
            return (
                <Dialog>
                    <DialogTrigger asChild={true}>
                        {children}
                    </DialogTrigger>
                    <DialogContent className="p-0 w-auto bg-transparent border-none max-w-md backdrop-blur-none">
                        <DialogTitle className="sr-only">Réinitialisation du mot de passe</DialogTitle>
                        <div className="bg-transparent">
                            <ResetForm />
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

