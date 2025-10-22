"use client";

import * as z from "zod";
import { useForm } from "react-hook-form"
import { CardWrapper } from "@/components/auth/card-wrapper";
import { useCallback, useEffect, useState, useTransition } from "react";
import { BeatLoader } from "react-spinners"
import { FormError } from "@/components/global/form-error";
import { FormSuccess } from "@/components/global/form-success";
import { useSearchParams } from "next/navigation";
import { TwoFactorSchema } from "@/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { newVerification } from "@/actions/auth/new-verification";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage

} from '@/components/ui/form'

import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot
} from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'



export const NewVerificationForm = () => {
    const [error, setError] = useState<string | undefined>();
    const [success, setSuccess] = useState<string | undefined>();
    const [isPending, startTransition] = useTransition()
    // const searchParams = useSearchParams();

    //const token = searchParams.get("token");

    const form = useForm<z.infer<typeof TwoFactorSchema >>({
        resolver: zodResolver(TwoFactorSchema),
        defaultValues: {
            code: ""
        },
    });
 
    const onSubmit =(data: z.infer<typeof TwoFactorSchema>) => {
        console.log(data);
        setError('')
        setSuccess('')

        startTransition(() => {
            newVerification(data)
                .then((response) => {
                    if(response.error) {
                        form.reset()
                        setError(response.error)
                    }

                    if(response.success) {
                        form.reset()
                        setSuccess(response.success)
                    }
                })
                .catch(() => setError("Une erreur s'est produite. Veuillez réessayer"))
        })
    }

 /*    const onSubmit = useCallback(() => {
       console.log(token);
        
        if (success || error ) return;
     
        if (!token) {
            setError("Jeton manquant !!")
            return;
        }
        newVerification(token)
            .then((data) => {
                setSuccess(data.success);
                setError(data.error);
            })
            .catch(() => {
                setError("Quelque chose s'est mal passée !")
            })

    }, [token, success, error]);

    useEffect(() => {
        onSubmit();
    }, [onSubmit]); */
    
    return (
        <CardWrapper
            labelBox= "Confirmer votre email"
            headerLabel= "Entrez ci-dessous, votre code OTP reçu par e-mail"
            backButtonLabel="Retour à la connexion"
            backButtonHref="/auth/sign-in"
        >
      <div className="flex items-center w-full justify-center">


      <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className='space-y-6'
                    >
                        <FormField 
                            name='code'
                            control={form.control}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Code</FormLabel>
                                    <FormControl>
                                        <InputOTP maxLength={6} {...field}>
                                            <InputOTPGroup>
                                                <InputOTPSlot index={0} />
                                                <InputOTPSlot index={1} />
                                            </InputOTPGroup>
                                            <InputOTPSeparator />
                                            <InputOTPGroup>
                                                <InputOTPSlot index={2} />
                                                <InputOTPSlot index={3} />
                                            </InputOTPGroup>
                                            <InputOTPSeparator />
                                            <InputOTPGroup>
                                                <InputOTPSlot index={4} />
                                                <InputOTPSlot index={5} />
                                            </InputOTPGroup>
                                        </InputOTP>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                       {/*  <FormSuccess message={success} />
                        <FormError message={error} /> */}
                        
                        <div className="flex items-center w-full justify-center" >
                            {!success && !error && (<BeatLoader />)}  
                                <FormSuccess message={success} />
                            {!success && (
                                <FormError message={error} /> 
                            )} 
                        </div>

                          <Button
                            type='submit'
                            disabled={isPending}
                            className='w-full'

                        >
                            Confirmer
                        </Button>

                    </form>
                </Form>




         

      </div> 
        </CardWrapper>
    )
}