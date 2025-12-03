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
import { Conditions } from "@/components/conditions";
import { StatuAmaki } from "@/components/statuamaki";
import { CheckCircle, FileText, Shield, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CountryAutocomplete } from "@/components/forms/country-autocomplete";
import { CityAutocomplete } from "@/components/forms/city-autocomplete";
import { LoginButton } from "@/components/auth/login-button";


export const RegisterForm = () => {
    const router = useRouter();
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
        startTransition(async () => {
            try {
                const response = await register(data);
                
                if (response?.error) {
                    form.reset();
                    setError(response.error);
                } else if (response?.twoFactor) {
                    setShowTwoFactor(true);
                } else if (response?.success) {
                    setSuccess(response.success || "Inscription réussie !");
                    // Fermer le modal après un court délai si on est dans un modal
                    setTimeout(() => {
                        router.refresh();
                        // Si on est dans un modal, on peut fermer la page ou rediriger
                        if (typeof window !== 'undefined' && window.location.pathname !== '/inscription') {
                            window.location.href = '/auth/new-verification';
                        }
                    }, 1500);
                }
            } catch (error: any) {
                // Gérer les erreurs de manière plus robuste
                console.error("Erreur lors de l'inscription:", error);
                
                // Vérifier si c'est une erreur de redirection Next.js (qui est normale)
                if (error?.digest?.startsWith('NEXT_REDIRECT') || 
                    error?.message?.includes('NEXT_REDIRECT') ||
                    error?.code === 'NEXT_REDIRECT' ||
                    error?.name === 'NEXT_REDIRECT') {
                    // C'est une redirection normale, ne pas afficher d'erreur
                    setSuccess("Inscription réussie !");
                    return;
                }
                
                setError(error?.message || "Une erreur s'est produite lors de l'inscription");
            }
        })
     };

     if (showTwoFactor) {
        router.push('/auth/new-verification');
        return null;
    }

    return (
       <div className="w-full flex items-center justify-center p-2 sm:p-4 relative">
            <div className="relative z-10 w-full">
                <CardWrapper
                labelBox="Inscription"
                headerLabel="Créez votre compte"
                backButtonLabel="Vous avez déjà un compte ?"
                backButtonComponent={
                    <LoginButton mode="modal">
                        <Button
                            variant="link"
                            size="sm"
                            type="button"
                            className="w-full text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 font-normal"
                        >
                            Vous avez déjà un compte ?
                        </Button>
                    </LoginButton>
                }
                showSocial={false}
            >
                <Form {...form}>
                    <form 
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-3"
                    >
                        <div className="space-y-3">
                            <FormField 
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                         <FormLabel className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nom complet *</FormLabel>
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
                                         <FormLabel className="text-sm font-semibold text-gray-900 dark:text-gray-100">Adresse e-mail *</FormLabel>
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
                                         <FormLabel className="text-sm font-semibold text-gray-900 dark:text-gray-100">Mot de passe *</FormLabel>
                                         <FormControl>
                                            <PasswordInput 
                                                {...field}
                                                disabled={isPending}
                                                placeholder="Minimum 6 caractères"
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
                            
                            {/* Champs optionnels - masqués par défaut */}
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                <details className="group">
                                    <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 list-none">
                                        <span className="flex items-center gap-1">
                                            <span>Informations optionnelles</span>
                                            <span className="text-gray-400 group-open:hidden">▼</span>
                                            <span className="text-gray-400 hidden group-open:inline">▲</span>
                                        </span>
                                    </summary>
                                    <div className="mt-3 space-y-3">
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
                                </details>
                            </div>
                        </div>

                        {/* Conditions légales */}
                        <div className="space-y-2 pt-3 border-t-2 border-gray-200 dark:border-gray-700">
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id="accept-conditions"
                                    checked={acceptConditions}
                                    onCheckedChange={(checked) => setAcceptConditions(checked === true)}
                                    className="mt-1"
                                />
                                <label 
                                    htmlFor="accept-conditions"
                                    className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed cursor-pointer"
                                >
                                    En créant un compte, vous acceptez les{" "}
                                    <button
                                        type="button"
                                        onClick={() => setShowConditions(true)}
                                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        conditions d'adhésion et d'utilisation d'Amaki France
                                    </button>
                                    . Consultez notre{" "}
                                    <button
                                        type="button"
                                        onClick={() => setShowStatut(true)}
                                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        statut juridique
                                    </button>
                                    {" "}et notre{" "}
                                    <button
                                        type="button"
                                        onClick={() => setShowConditions(true)}
                                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                        déclaration de confidentialité
                                    </button>
                                    .
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
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
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
