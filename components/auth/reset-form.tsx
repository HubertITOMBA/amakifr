"use client"
import * as z from "zod";
import { useForm } from "react-hook-form"
import { useState, useTransition } from "react"
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
   
    return (
        <CardWrapper
            labelBox= "Mot de passe oublié "
            headerLabel="Vous avez ouvblié votre mot de passe ?  Entre votre adresse email pour reinitialisez votre mot de passe ?"
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