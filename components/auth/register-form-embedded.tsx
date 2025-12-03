"use client"

import * as z from "zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RegisterSchema } from "@/schemas";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Conditions } from "@/components/conditions";
import { StatuAmaki } from "@/components/statuamaki";
import { CheckCircle, FileText, Shield, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CountryAutocomplete } from "@/components/forms/country-autocomplete";
import { CityAutocomplete } from "@/components/forms/city-autocomplete";
import { Social } from "@/components/auth/social";


export const RegisterFormEmbedded = () => {
    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();
    const [showTwoFactor, setShowTwoFactor] = useState(false);
    const [showConditions, setShowConditions] = useState(false);
    const [showStatut, setShowStatut] = useState(false);
    const [acceptConditions, setAcceptConditions] = useState(false);
    const [countryCode, setCountryCode] = useState<string>("");
    const router = useRouter();

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
                        router.push('/auth/new-verification');
                    }
                })
                .catch((error) => {
                    setError("Une erreur s'est produite lors de l'inscription")
                })
        })
     };

    return (
        <Card className="w-full shadow-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
            <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold text-center text-gray-900 dark:text-white">
                    Formulaire d'inscription
                </CardTitle>
                <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-2">
                    Remplissez les champs ci-dessous pour créer votre compte
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
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
                                                className="placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                                                className="placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                                            <PasswordInput 
                                                {...field}
                                                disabled={isPending}
                                                placeholder="Minimum 6 caractères"
                                                className="placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                                                    className="placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                                />
                                             </FormControl>
                                             <FormDescription className="text-xs text-gray-500 dark:text-gray-400">
                                                Si vous êtes ancien élève de Kipaku, indiquez votre année de promotion
                                             </FormDescription>
                                             <FormMessage />
                                        </FormItem>                                
                                    )}
                                />
                                
                                <div className="space-y-3 mt-3">
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
                                            <FormItem className="relative z-[4]">
                                                 <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ville</FormLabel>
                                                 <FormControl>
                                                    <div className="relative z-[4]">
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

                            {/* Acceptation des conditions */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-start space-x-3">
                                    <Checkbox
                                        id="acceptConditions"
                                        checked={acceptConditions}
                                        onCheckedChange={(checked) => setAcceptConditions(checked === true)}
                                        className="mt-1"
                                    />
                                    <label
                                        htmlFor="acceptConditions"
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
                        </div>

                        <FormError message={error}/>
                        <FormSuccess message={success} />
                        
                        <Button
                            disabled={isPending || !acceptConditions}
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-6"
                        >
                            {isPending ? "Création en cours..." : "Créer mon compte"}
                        </Button>
                    </form>
                </Form>

                {/* Connexion sociale */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-center mb-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Ou inscrivez-vous avec
                        </p>
                    </div>
                    <Social />
                </div>

                {/* Message de réassurance */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
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
            </CardContent>

            {/* Dialogs */}
            <Conditions open={showConditions} onOpenChange={setShowConditions} />
            <StatuAmaki open={showStatut} onOpenChange={setShowStatut} />
        </Card>
    )
}

