"use client";

import * as z from "zod";
import { useForm } from "react-hook-form"
import { CardWrapper } from "@/components/auth/card-wrapper";
import { useEffect, useState, useTransition } from "react";
import { BeatLoader } from "react-spinners"
import { EmailVerificationSchema, ResendVerificationSchema } from "@/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { newVerification } from "@/actions/auth/new-verification";
import { resendVerificationCode } from "@/actions/auth/resend-verification-code";
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
import { Input } from "@/components/ui/input";
import { Button } from '@/components/ui/button'
import { LoginButton } from "@/components/auth/login-button";
import { 
    Shield, 
    Mail, 
    Clock, 
    CheckCircle2, 
    AlertCircle,
    RefreshCw,
    Sparkles,
    Lock
} from "lucide-react"

const VERIFY_GENERIC =
  "Code invalide, expiré ou indisponible. Demandez un nouveau code.";

/**
 * Page de saisie du code de confirmation + demande de renvoi.
 * Un seul champ email (jamais en query string) pour vérification et renvoi.
 * Aucun log du code ni de l'email. La DB reste l'autorité sur le plafond.
 */
export const NewVerificationForm = () => {
    const [error, setError] = useState<string | undefined>();
    const [success, setSuccess] = useState<string | undefined>();
    const [resendMessage, setResendMessage] = useState<string | undefined>();
    const [resendError, setResendError] = useState<string | undefined>();
    const [isPending, startTransition] = useTransition();
    const [isResending, startResendTransition] = useTransition();
    const [timeLeft, setTimeLeft] = useState(0);
    const [attempts, setAttempts] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const maxAttempts = 3;

    const form = useForm<z.infer<typeof EmailVerificationSchema>>({
        resolver: zodResolver(EmailVerificationSchema),
        defaultValues: {
            email: "",
            code: "",
        },
    });

    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [timeLeft]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const onSubmit = (data: z.infer<typeof EmailVerificationSchema>) => {
        setError('');
        setSuccess('');
        setResendError(undefined);
        setIsAnimating(true);

        if (attempts >= maxAttempts) {
            setError("Trop de tentatives. Veuillez demander un nouveau code.");
            setIsAnimating(false);
            return;
        }

        startTransition(() => {
            newVerification(data)
                .then((response) => {
                    if (response.error) {
                        form.setValue("code", "");
                        setAttempts((prev) => {
                            const next = prev + 1;
                            if (next >= maxAttempts) {
                                setError(
                                    `${VERIFY_GENERIC} Demandez un nouveau code via le bouton ci-dessous.`,
                                );
                            } else {
                                setError(response.error);
                            }
                            return next;
                        });
                    }

                    if (response.success) {
                        form.reset({ email: data.email, code: "" });
                        setSuccess(response.success);
                        setTimeout(() => {
                            window.location.href = '/auth/onboarding';
                        }, 1500);
                    }
                    setIsAnimating(false);
                })
                .catch(() => {
                    setError("Une erreur s'est produite. Veuillez réessayer");
                    setIsAnimating(false);
                })
        })
    };

    const onResend = () => {
        setResendError(undefined);
        setResendMessage(undefined);
        setError(undefined);

        const email = form.getValues("email");
        const parsed = ResendVerificationSchema.safeParse({ email });
        if (!parsed.success) {
            form.setError("email", {
                message:
                    parsed.error.issues[0]?.message ||
                    "Une adresse e-mail valide est requise",
            });
            return;
        }

        startResendTransition(() => {
            resendVerificationCode({ email: parsed.data.email })
                .then((response) => {
                    if ("error" in response && response.error) {
                        setResendError(response.error);
                        return;
                    }
                    if ("accepted" in response && response.accepted) {
                        setResendMessage(response.message);
                        setAttempts(0);
                        setTimeLeft(60);
                    }
                })
                .catch(() => {
                    setResendError("Envoi temporairement impossible. Réessayez plus tard.");
                });
        });
    };

    const cooldownActive = timeLeft > 0;
    const resendDisabled = isPending || isResending || cooldownActive;

    return (
        <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
            <div className="w-full max-w-md transform transition-all duration-500 ease-out">
                <CardWrapper
                    labelBox="Vérification de sécurité"
                    headerLabel="Entrez le code de vérification"
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
                    <div className="space-y-4 sm:space-y-6">
                        <div className="text-center">
                            <div className="relative inline-block">
                                <div className="absolute inset-0 animate-spin">
                                    <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 opacity-20" />
                                </div>
                                <div className="relative">
                                    <Shield className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600 mx-auto drop-shadow-lg" />
                                </div>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mt-3 sm:mt-4">
                                Vérification en cours
                            </h2>
                            <p className="text-gray-600 dark:text-gray-300 mt-1 sm:mt-2 text-xs sm:text-sm px-2">
                                Saisissez votre e-mail et le code à 6 chiffres reçu
                            </p>
                        </div>

                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-3 sm:p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center space-x-1.5 sm:space-x-2">
                                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
                                    <span className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 font-medium">
                                        Confirmation d&apos;inscription
                                    </span>
                                </div>
                                {cooldownActive && (
                                    <div className="flex items-center space-x-1.5 sm:space-x-2">
                                        <Clock className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 ${timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-orange-600'}`} />
                                        <span className={`text-xs sm:text-sm font-mono font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-orange-600'}`}>
                                            {formatTime(timeLeft)}
                                        </span>
                                    </div>
                                )}
                            </div>
                            
                            {attempts > 0 && (
                                <div className="mt-2 sm:mt-3 flex items-center space-x-1.5 sm:space-x-2">
                                    <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 flex-shrink-0" />
                                    <span className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 font-medium">
                                        Tentatives: {attempts}/{maxAttempts}
                                    </span>
                                </div>
                            )}
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
                                <FormField
                                    name="email"
                                    control={form.control}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                Adresse e-mail
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    type="email"
                                                    autoComplete="email"
                                                    disabled={isPending || isResending}
                                                    placeholder="votre.adresse@exemple.com"
                                                    className="text-sm"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField 
                                    name="code"
                                    control={form.control}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center space-x-1.5 sm:space-x-2">
                                                <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                                                <span>Code de vérification</span>
                                            </FormLabel>
                                            <FormControl>
                                                <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                                                    <div className="transform transition-all duration-300 hover:scale-105 w-full flex justify-center">
                                                        <InputOTP 
                                                            maxLength={6} 
                                                            {...field}
                                                            containerClassName="justify-center w-full max-w-fit"
                                                        >
                                                            <InputOTPGroup className="gap-0.5 sm:gap-1">
                                                                <InputOTPSlot 
                                                                    index={0} 
                                                                    className="h-9 w-9 sm:h-11 sm:w-11 text-sm sm:text-base font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                                <InputOTPSlot 
                                                                    index={1} 
                                                                    className="h-9 w-9 sm:h-11 sm:w-11 text-sm sm:text-base font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                            </InputOTPGroup>
                                                            <InputOTPSeparator className="mx-0.5 sm:mx-1 text-gray-400 font-bold text-xs sm:text-sm">-</InputOTPSeparator>
                                                            <InputOTPGroup className="gap-0.5 sm:gap-1">
                                                                <InputOTPSlot 
                                                                    index={2} 
                                                                    className="h-9 w-9 sm:h-11 sm:w-11 text-sm sm:text-base font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                                <InputOTPSlot 
                                                                    index={3} 
                                                                    className="h-9 w-9 sm:h-11 sm:w-11 text-sm sm:text-base font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                            </InputOTPGroup>
                                                            <InputOTPSeparator className="mx-0.5 sm:mx-1 text-gray-400 font-bold text-xs sm:text-sm">-</InputOTPSeparator>
                                                            <InputOTPGroup className="gap-0.5 sm:gap-1">
                                                                <InputOTPSlot 
                                                                    index={4} 
                                                                    className="h-9 w-9 sm:h-11 sm:w-11 text-sm sm:text-base font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                                <InputOTPSlot 
                                                                    index={5} 
                                                                    className="h-9 w-9 sm:h-11 sm:w-11 text-sm sm:text-base font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                            </InputOTPGroup>
                                                        </InputOTP>
                                                    </div>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="space-y-2 sm:space-y-3">
                                    {isPending && (
                                        <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 sm:p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                                            <BeatLoader size={8} />
                                            <span className="text-xs sm:text-sm font-medium">Vérification en cours...</span>
                                        </div>
                                    )}
                                    
                                    {success && (
                                        <div className="flex items-center space-x-2 sm:space-x-3 text-green-600 bg-green-50 dark:bg-green-900/20 p-3 sm:p-4 rounded-xl border border-green-200 dark:border-green-800 shadow-sm">
                                            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                                            <span className="text-xs sm:text-sm font-medium">{success}</span>
                                        </div>
                                    )}
                                    
                                    {error && (
                                        <div className="flex items-center space-x-2 sm:space-x-3 text-red-600 bg-red-50 dark:bg-red-900/20 p-3 sm:p-4 rounded-xl border border-red-200 dark:border-red-800 shadow-sm">
                                            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                                            <span className="text-xs sm:text-sm font-medium">{error}</span>
                                        </div>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isPending || attempts >= maxAttempts}
                                    className={`w-full h-10 sm:h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm sm:text-base font-semibold rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 hover:shadow-xl ${isAnimating ? 'animate-pulse' : ''}`}
                                >
                                    {isPending ? (
                                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                                            <BeatLoader size={6} color="white" />
                                            <span>Vérification...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                                            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                            <span>Vérifier le code</span>
                                        </div>
                                    )}
                                </Button>
                            </form>
                        </Form>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center">
                                Vous n&apos;avez pas reçu le code ? Utilisez l&apos;e-mail saisi ci-dessus pour en demander un nouveau.
                            </p>
                            {resendMessage && (
                                <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2.5">
                                    {resendMessage}
                                </p>
                            )}
                            {resendError && (
                                <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2.5">
                                    {resendError}
                                </p>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                disabled={resendDisabled}
                                onClick={onResend}
                                className="w-full h-9 sm:h-10 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl hover:border-blue-500 hover:text-blue-600 text-xs sm:text-sm"
                            >
                                <div className="flex items-center space-x-1.5 sm:space-x-2">
                                    <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isResending || cooldownActive ? 'animate-spin' : ''}`} />
                                    <span className="font-medium">
                                        {isResending
                                            ? "Envoi en cours..."
                                            : cooldownActive
                                              ? `Renvoyer dans ${formatTime(timeLeft)}`
                                              : "Renvoyer le code"}
                                    </span>
                                </div>
                            </Button>
                        </div>

                        <div className="text-center text-xs text-gray-500 dark:text-gray-400 space-y-1.5 sm:space-y-2 bg-gray-50 dark:bg-gray-800/50 p-3 sm:p-4 rounded-xl">
                            <p className="text-xs">Vérifiez votre dossier spam si vous ne recevez pas l&apos;e-mail</p>
                        </div>
                    </div>
                </CardWrapper>
            </div>
        </div>
    )
}
