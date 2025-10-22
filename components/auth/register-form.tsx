"use client"

import * as z from "zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod";
//import Link from "next/link"
import { RegisterSchema } from "@/schemas";
import { Input } from "@/components/ui/input";
import { CardWrapper } from "./card-wrapper"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form"
import { Button } from "@/components/ui/button";
import { FormError } from '@/components/global/form-error';
import { FormSuccess } from '@/components/global/form-success';
import { register } from "@/actions/auth/register";
import { redirect } from 'next/navigation'


export const RegisterForm = () => {
    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();
    const [ showTwoFactor, setShowTwoFactor ] = useState(false)

    const form = useForm<z.infer<typeof RegisterSchema>>({
        resolver: zodResolver(RegisterSchema),
        defaultValues: {
            email: "",
            password: "",
            name: ""
        },
    });

    const onSubmit = (data: z.infer<typeof RegisterSchema>) => {
        console.log(data);
        setError("");
        setSuccess("");
        startTransition(() => {
            register(data)
                .then((response) => {
                    if (response.error) {
                        form.reset()
                        setError(response.error)
                    }

                    if(response.twoFactor) {
                        setShowTwoFactor(true)
                    }
                })
                .catch((error) => {
                    setError("Une erreur s'est produite ON SUBMIT")
                })
        })
     };

     if (showTwoFactor) {
        return redirect('/auth/new-verification');
    }
    
    const onClick = (provider: 'google') => {
        signIn(provider, { callbackUrl: DEFAULT_LOGIN_REDIRECT})
    }



    return (
       <CardWrapper
            labelBox= "Inscription"
            headerLabel = "Demandez dès aujourd'hui votre adhésion !"
            backButtonLabel="Vous avez déjà un compte ?"
            backButtonHref="/auth/sign-in"
            showSocial
       >
            <Form {...form}>
                <form 
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                >
                    <div className="space-y-4">
                        <FormField 
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                     <FormLabel>Nom</FormLabel>
                                     <FormControl>
                                        <Input 
                                            {...field}
                                            disabled={isPending}
                                            placeholder="Hubert Balu Itomba"
                                        />
                                     </FormControl>
                                     <FormMessage />
                                </FormItem>                                
                            )}
                        />
                        <FormField 
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                     <FormLabel>E-mail</FormLabel>
                                     <FormControl>
                                        <Input 
                                            {...field}
                                            disabled={isPending}
                                            placeholder="votre.boite@gmail.com"
                                            type="email"
                                        />
                                     </FormControl>
                                     <FormMessage />
                                </FormItem>                                
                            )}
                        />
                        <FormField 
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                     <FormLabel>Mot de passe</FormLabel>
                                     <FormControl>
                                        <Input 
                                            {...field}
                                            disabled={isPending}
                                            placeholder="*******"
                                            type="password"
                                        />
                                     </FormControl>
                                     <FormMessage />
                                </FormItem>                                
                            )}
                        />
                    </div>
                    <FormError message={error}/>
                    <FormSuccess message={success} />
                    
                    <Button
                        disabled={isPending}
                        type="submit"
                        className="w-full"
                    >
                        Créer un compte 
                    </Button>
                </form>
            </Form>

       </CardWrapper>
    )
}