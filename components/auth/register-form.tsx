"use client"

import * as z from "zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { RegisterSchema } from "@/schemas";
import { Input } from "@/components/ui/input";
import { CardWrapper } from "./card-wrapper"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription
} from "@/components/ui/form"
import { Button } from "@/components/ui/button";
import { FormError } from '@/components/global/form-error';
import { FormSuccess } from '@/components/global/form-success';
import { register } from "@/actions/auth/register";
import { redirect } from 'next/navigation'
import { Conditions } from "@/components/conditions";
import { StatuAmaki } from "@/components/statuamaki";
import { CheckCircle, FileText, Shield, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CountryAutocomplete } from "@/components/forms/country-autocomplete";
import { CityAutocomplete } from "@/components/forms/city-autocomplete";


export const RegisterForm = () => {
    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();
    const [showTwoFactor, setShowTwoFactor] = useState(false);
    const [showConditions, setShowConditions] = useState(false);
    const [showStatut, setShowStatut] = useState(false);
    const [acceptConditions, setAcceptConditions] = useState(false);
    const [countryCode, setCountryCode] = useState<string>("");

    const form = useForm<z.infer<typeof RegisterSchema>>({
        resolver: zodResolver(RegisterSchema),
        defaultValues: {
            email: "",
            password: "",
            name: "",
            anneePromotion: "",
            pays: "",
            ville: "",
        },
    });

    const onSubmit = (data: z.infer<typeof RegisterSchema>) => {
        if (!acceptConditions) {
            setError("Vous devez accepter les conditions d'utilisation pour créer un compte");
            return;
        }

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
                    setError("Une erreur s'est produite lors de l'inscription")
                })
        })
     };

     if (showTwoFactor) {
        return redirect('/auth/new-verification');
    }

    return (
       <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white/20 to-blue-50/30 backdrop-blur-sm flex items-center justify-center p-4 relative">
            {/* Effet de flou d'arrière-plan pour renforcer l'effet de flottement */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100/20 via-transparent to-blue-100/20 pointer-events-none"></div>
            <div className="relative z-10 w-full">
                <CardWrapper
                labelBox="Inscription"
                headerLabel="Créez votre compte"
                backButtonLabel="Vous avez déjà un compte ?"
                backButtonHref="/auth/sign-in"
                showSocial
            >
                <Form {...form}>
                    <form 
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-5"
                    >
                        <div className="space-y-4">
                            <FormField 
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                         <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nom complet *</FormLabel>
                                         <FormControl>
                                            <Input 
                                                {...field}
                                                disabled={isPending}
                                                placeholder="Hubert Balu Itomba"
                                                className="placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
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
                                         <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">Adresse e-mail *</FormLabel>
                                         <FormControl>
                                            <Input 
                                                {...field}
                                                disabled={isPending}
                                                placeholder="votre.boite@gmail.com"
                                                type="email"
                                                className="placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
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
                                         <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mot de passe *</FormLabel>
                                         <FormControl>
                                            <Input 
                                                {...field}
                                                disabled={isPending}
                                                placeholder="Minimum 6 caractères"
                                                type="password"
                                                className="placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
                                            />
                                         </FormControl>
                                         <FormDescription className="text-xs text-gray-500 dark:text-gray-400">
                                            Minimum 6 caractères requis
                                         </FormDescription>
                                         <FormMessage />
                                    </FormItem>                                
                                )}
                            />
                            
                            {/* Champs optionnels */}
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                                    Informations optionnelles (recommandées)
                                </p>
                                
                                <FormField 
                                    control={form.control}
                                    name="anneePromotion"
                                    render={({ field }) => (
                                        <FormItem>
                                             <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">Année de promotion</FormLabel>
                                             <FormControl>
                                                <Input 
                                                    {...field}
                                                    disabled={isPending}
                                                    placeholder="2010 ou 'Je ne suis pas ancien élève'"
                                                    className="placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
                                                />
                                             </FormControl>
                                             <FormDescription className="text-xs text-gray-500 dark:text-gray-400">
                                                Si vous êtes ancien élève de Kipaku, indiquez votre année de promotion
                                             </FormDescription>
                                             <FormMessage />
                                        </FormItem>                                
                                    )}
                                />
                                
                                <div className="space-y-3">
                                    <FormField 
                                        control={form.control}
                                        name="pays"
                                        render={({ field }) => (
                                            <FormItem className="relative z-[5]">
                                                 <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pays</FormLabel>
                                                 <FormControl>
                                                    <div className="relative z-[5]">
                                                        <CountryAutocomplete
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            onCountryCodeChange={setCountryCode}
                                                            disabled={isPending}
                                                            placeholder="Sélectionner un pays..."
                                                        />
                                                    </div>
                                                 </FormControl>
                                                 <FormMessage />
                                            </FormItem>                                
                                        )}
                                    />
                                    <FormField 
                                        control={form.control}
                                        name="ville"
                                        render={({ field }) => (
                                            <FormItem className="relative z-[10]">
                                                 <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ville</FormLabel>
                                                 <FormControl>
                                                    <div className="relative z-[10]">
                                                        <CityAutocomplete
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            countryCode={countryCode}
                                                            disabled={isPending}
                                                            placeholder="Sélectionner une ville..."
                                                        />
                                                    </div>
                                                 </FormControl>
                                                 <FormMessage />
                                            </FormItem>                                
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Conditions légales */}
                        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id="accept-conditions"
                                    checked={acceptConditions}
                                    onCheckedChange={(checked) => setAcceptConditions(checked === true)}
                                    className="mt-1"
                                />
                                <label 
                                    htmlFor="accept-conditions"
                                    className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed cursor-pointer"
                                >
                                    En créant un compte, vous acceptez nos{" "}
                                    <button
                                        type="button"
                                        onClick={() => setShowConditions(true)}
                                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        Conditions d'utilisation
                                    </button>
                                    {" "}et notre{" "}
                                    <button
                                        type="button"
                                        onClick={() => setShowStatut(true)}
                                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        Statut juridique
                                    </button>
                                    . Vos données sont protégées et ne seront jamais partagées sans votre accord.
                                </label>
                            </div>
                        </div>

                        <FormError message={error}/>
                        <FormSuccess message={success} />
                        
                        <Button
                            disabled={isPending || !acceptConditions}
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {isPending ? "Création en cours..." : "Créer mon compte"}
                        </Button>
                    </form>
                </Form>

                {/* Message de réassurance */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Gratuit et sans engagement</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Vous pouvez modifier vos informations à tout moment</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Communauté bienveillante et sécurisée</span>
                        </div>
                    </div>
                </div>
                </CardWrapper>
            </div>

            {/* Dialogs */}
            <Conditions open={showConditions} onOpenChange={setShowConditions} />
            <StatuAmaki open={showStatut} onOpenChange={setShowStatut} />
        </div>
    )
}
