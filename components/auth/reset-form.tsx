"use client"
import * as z from "zod";
import * as React from "react";
import { useForm } from "react-hook-form"
import { useState, useTransition } from "react"
import { usePathname } from "next/navigation";
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
import { DialogClose } from "@/components/ui/dialog";
import Link from "next/link";

/**
 * Formulaire web « mot de passe oublié » — réponse générique anti-énumération.
 */
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
          setError("");
          setSuccess("");
                
        startTransition(() => {
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
   
    const BackToLoginButton = () => {
        const pathname = usePathname();
        const isStandalonePage = pathname === "/auth/reset";
        const callbackUrl = encodeURIComponent(pathname || "/");
        const href = `/auth/sign-in?callbackUrl=${callbackUrl}`;

        const button = (
            <Link href={href} className="w-full">
                <Button
                    variant="link"
                    size="sm"
                    type="button"
                    className="w-full text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 font-normal"
                >
                    Retour à la connexion
                </Button>
            </Link>
        )
        
        if (isStandalonePage) {
            return button;
        }
        
        return (
            <DialogClose asChild>
                {button}
            </DialogClose>
        );
    };

    return (
        <CardWrapper
            labelBox= "Mot de passe oublié "
            headerLabel="Entrez votre adresse e-mail. Si un compte correspond, un code de réinitialisation vous sera envoyé."
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
                                        <FormLabel>Adresse e-mail</FormLabel>
                                        <FormControl>
                                            <Input 
                                                {...field}
                                                 disabled={isPending}
                                                 placeholder=""
                                                type="email"
                                                autoComplete="email"
                                                autoFocus
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
                           Envoyer un code de réinitialisation
                        </Button>
                    </form>
                </Form>
        </CardWrapper>
    );    
};
