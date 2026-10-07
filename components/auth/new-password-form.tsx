"use client"
import * as z from "zod";
import { useForm } from "react-hook-form"
import { useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod";
import { NewPasswordSchema } from "@/schemas";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
import { LoginButton } from "@/components/auth/login-button";

/**
 * Formulaire web nouveau mot de passe : email + code 8 chiffres + MDP + confirmation.
 * Aucun secret dans l'URL (pas de ?token=).
 */
export const NewPasswordForm = () => {
    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof NewPasswordSchema>>({
        resolver: zodResolver(NewPasswordSchema),
        defaultValues: {
            email: "",
            code: "",
            password: "",
            confirmPassword: "",
         },
    });

    const onSubmit = (data: z.infer<typeof NewPasswordSchema>) => {
        setError("")
        setSuccess("")

        startTransition(() => {
            newPassword(data)
                .then((response) => {
                    if(response.error){
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
            headerLabel="Saisissez votre e-mail, le code reçu et votre nouveau mot de passe."
            backButtonLabel="Retour à la connexion"
            backButtonComponent={
                <LoginButton mode="modal">
                    <Button
                        variant="link"
                        size="sm"
                        type="button"
                        className="w-full text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 font-normal"
                    >
                        Retour à la connexion
                    </Button>
                </LoginButton>
            }
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
                                                type="email"
                                                autoComplete="email"
                                                autoFocus
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                               control={form.control}
                               name="code"
                               render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Code à 8 chiffres</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                disabled={isPending}
                                                inputMode="numeric"
                                                autoComplete="one-time-code"
                                                maxLength={8}
                                                placeholder="********"
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
                                        <FormLabel>Nouveau mot de passe</FormLabel>
                                        <FormControl>
                                            <PasswordInput 
                                                {...field}
                                                 disabled={isPending}
                                                 placeholder="******"
                                                 autoComplete="new-password"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}   
                            />
                            <FormField
                               control={form.control}
                               name="confirmPassword"
                               render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirmation</FormLabel>
                                        <FormControl>
                                            <PasswordInput
                                                {...field}
                                                disabled={isPending}
                                                placeholder="******"
                                                autoComplete="new-password"
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
