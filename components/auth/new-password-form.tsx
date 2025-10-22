"use client"
import * as z from "zod";
import { useForm } from "react-hook-form"
import { useState, useTransition } from "react"
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { NewPasswordSchema } from "@/schemas";
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
import { newPassword } from "@/actions/auth/new-password";


export const NewPasswordForm = () => {
    const searchParams = useSearchParams();
    const token = searchParams.get("token")

    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof NewPasswordSchema>>({
        resolver: zodResolver(NewPasswordSchema),
        defaultValues: {
            password: ""
         },
    });

    const onSubmit = (data: z.infer<typeof NewPasswordSchema>) => {
        // console.log(data);
        setError("")
        setSuccess("")

        startTransition(() => {
            newPassword(data, token)
                .then((response) => {
                    if(response.error){
                        form.reset()
                        setError(response.error)
                    }

                    if (response.success){
                        form.reset()
                        setSuccess(response.success)
                    }
                })
                .catch(() => setError("Une erreur s'est produite"))
        })
    }
    return (
        <CardWrapper
            labelBox= "Nouveau mot de passe"
            headerLabel="Entrez votre nouveau mot de passe ?"
            backButtonLabel="Retour à la connexion"
            backButtonHref="/auth/sign-in"
            >
                <Form {...form}>
                    <form 
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                    >
                        <div className="space-y-4">
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
                                                 placeholder="******"
                                                type="password"
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
                           Réinitialiser le mot de passe  
                        </Button>
                    </form>
                </Form>
        </CardWrapper>
    );
};