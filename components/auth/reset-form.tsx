"use client"
import * as z from "zod";
import * as React from "react";
import { useForm } from "react-hook-form"
import { useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ResetSchema } from "@/schemas";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form"
import { CardWrapper } from "@/components/auth/card-wrapper"
import { Button } from "@/components/ui/button";
import { FormError } from '@/components/global/form-error';
import { FormSuccess } from '@/components/global/form-success';
import { reset } from "@/actions/auth/reset";
import { LoginButton } from "@/components/auth/login-button";
import { DialogClose } from "@/components/ui/dialog";


export const ResetForm = () => {

    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof ResetSchema>>({
        resolver: zodResolver(ResetSchema),
        defaultValues: {
            email: ""
         },
    });

    const onSubmit = (data: z.infer<typeof ResetSchema>) => {
        console.log(data);
          setError("");
          setSuccess("");
                
        startTransition(() => {;
         reset(data)
         .then ((response) => {
                if (response.error) {
                    form.reset()  
                    setError(response?.error)
                }

                if (response.success) {
                    setSuccess(response?.success)
                }
               
            })
            .catch(() => setError("Une erreur s'est produite !"))
         }) 
    }    
   
    // Composant pour le bouton "Retour à la connexion" qui ferme ce modal et ouvre le modal de connexion
    const BackToLoginButton = () => {
        const pathname = usePathname();
        const router = useRouter();
        const [shouldOpenLogin, setShouldOpenLogin] = useState(false);
        const loginTriggerRef = React.useRef<HTMLButtonElement>(null);
        
        // Vérifier si on est sur la page standalone (pas dans un modal)
        const isStandalonePage = pathname === "/auth/reset";
        
        const handleClick = () => {
            if (isStandalonePage) {
                // Si on est sur la page standalone, rediriger vers la page de connexion
                router.push("/auth/sign-in");
            } else {
                // Si on est dans un modal, marquer qu'on doit ouvrir le modal de connexion après la fermeture
                setShouldOpenLogin(true);
            }
        };
        
        // Ouvrir le modal de connexion après un court délai si nécessaire
        React.useEffect(() => {
            if (!isStandalonePage && shouldOpenLogin && loginTriggerRef.current) {
                const timer = setTimeout(() => {
                    loginTriggerRef.current?.click();
                    setShouldOpenLogin(false);
                }, 200);
                return () => clearTimeout(timer);
            }
        }, [shouldOpenLogin, isStandalonePage]);
        
        const button = (
            <Button
                variant="link"
                size="sm"
                type="button"
                onClick={handleClick}
                className="w-full text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 font-normal"
            >
                Retour à la connexion
            </Button>
        );
        
        // Si on est dans un modal, utiliser DialogClose, sinon utiliser le bouton directement
        if (isStandalonePage) {
            return button;
        }
        
        return (
            <>
                <DialogClose asChild>
                    {button}
                </DialogClose>
                {shouldOpenLogin && (
                    <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                        <LoginButton mode="modal">
                            <button 
                                ref={loginTriggerRef}
                                type="button" 
                                style={{ display: 'none' }}
                            />
                        </LoginButton>
                    </div>
                )}
            </>
        );
    };

    return (
        <CardWrapper
            labelBox= "Mot de passe oublié "
            headerLabel="Vous avez ouvblié votre mot de passe ?  Entre votre adresse email pour reinitialisez votre mot de passe ?"
            backButtonComponent={<BackToLoginButton />}
            >
                <Form {...form}>
                    <form 
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        <div className="space-y-4">
                            <FormField
                               control={form.control}
                               name="email"
                               render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email adresse</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field}
                                                 disabled={isPending}
                                                 placeholder=""
                                                type="email"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}   
                            />
                        </div> 
                        <FormError message={error}/>
                        <FormSuccess message={success}/>
                        <Button
                            disabled={isPending}
                            type="submit"
                            className="w-full"
                        >
                           Envoyer un e-mail de réinitialisation  
                        </Button>
                    </form>
                </Form>
        </CardWrapper>
    );    
};    