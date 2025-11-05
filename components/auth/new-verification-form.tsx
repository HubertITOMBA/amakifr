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
import { 
    Shield, 
    Mail, 
    Clock, 
    CheckCircle2, 
    AlertCircle,
    RefreshCw,
    Sparkles,
    Eye,
    EyeOff,
    Lock
} from "lucide-react"

export const NewVerificationForm = () => {
    const [error, setError] = useState<string | undefined>();
    const [success, setSuccess] = useState<string | undefined>();
    const [isPending, startTransition] = useTransition();
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [showCode, setShowCode] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const maxAttempts = 3;

    const form = useForm<z.infer<typeof TwoFactorSchema>>({
        resolver: zodResolver(TwoFactorSchema),
        defaultValues: {
            code: ""
        },
    });

    // Timer countdown
    useEffect(() => {
        if (timeLeft > 0) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [timeLeft]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const onSubmit = (data: z.infer<typeof TwoFactorSchema>) => {
        console.log(data);
        setError('');
        setSuccess('');
        setAttempts(prev => prev + 1);
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
                        form.reset();
                        setError(response.error);
                    }

                    if (response.success) {
                        form.reset();
                        setSuccess(response.success);
                    }
                    setIsAnimating(false);
                })
                .catch(() => {
                    const errorMsg = "Une erreur s'est produite. Veuillez réessayer";
                    setError(errorMsg);
                    setIsAnimating(false);
                })
        })
    };

    const resendCode = () => {
        setTimeLeft(300);
        setAttempts(0);
        setError('');
        setSuccess('');
    };

    const toggleShowCode = () => {
        setShowCode(!showCode);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md transform transition-all duration-500 ease-out">
                <CardWrapper
                    labelBox="🔐 Vérification de sécurité"
                    headerLabel="Entrez le code de vérification"
                    backButtonLabel="Retour à la connexion"
                    backButtonHref="/auth/sign-in"
                >
                    <div className="space-y-4 sm:space-y-6">
                        {/* Header avec icône animée */}
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
                                Nous avons envoyé un code à 6 chiffres à votre adresse email
                            </p>
                        </div>

                        {/* Timer et informations */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-3 sm:p-4 border border-blue-200 dark:border-blue-800 shadow-sm">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center space-x-1.5 sm:space-x-2">
                                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
                                    <span className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 font-medium">
                                        Code envoyé par email
                                    </span>
                                </div>
                                <div className="flex items-center space-x-1.5 sm:space-x-2">
                                    <Clock className={`h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 ${timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-orange-600'}`} />
                                    <span className={`text-xs sm:text-sm font-mono font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-orange-600'}`}>
                                        {formatTime(timeLeft)}
                                    </span>
                                </div>
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

                        {/* Formulaire OTP */}
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
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
                                                <div className="flex items-center justify-center gap-1 sm:gap-2">
                                                    <div className="transform transition-all duration-300 hover:scale-105">
                                                        <InputOTP 
                                                            maxLength={6} 
                                                            {...field}
                                                            containerClassName="justify-center"
                                                        >
                                                            <InputOTPGroup className="gap-1 sm:gap-2">
                                                                <InputOTPSlot 
                                                                    index={0} 
                                                                    className="h-10 w-10 sm:h-12 sm:w-12 text-base sm:text-lg font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                                <InputOTPSlot 
                                                                    index={1} 
                                                                    className="h-10 w-10 sm:h-12 sm:w-12 text-base sm:text-lg font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                            </InputOTPGroup>
                                                            <InputOTPSeparator className="mx-1 sm:mx-2 text-gray-400 font-bold text-sm sm:text-base">-</InputOTPSeparator>
                                                            <InputOTPGroup className="gap-1 sm:gap-2">
                                                                <InputOTPSlot 
                                                                    index={2} 
                                                                    className="h-10 w-10 sm:h-12 sm:w-12 text-base sm:text-lg font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                                <InputOTPSlot 
                                                                    index={3} 
                                                                    className="h-10 w-10 sm:h-12 sm:w-12 text-base sm:text-lg font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                            </InputOTPGroup>
                                                            <InputOTPSeparator className="mx-1 sm:mx-2 text-gray-400 font-bold text-sm sm:text-base">-</InputOTPSeparator>
                                                            <InputOTPGroup className="gap-1 sm:gap-2">
                                                                <InputOTPSlot 
                                                                    index={4} 
                                                                    className="h-10 w-10 sm:h-12 sm:w-12 text-base sm:text-lg font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                                <InputOTPSlot 
                                                                    index={5} 
                                                                    className="h-10 w-10 sm:h-12 sm:w-12 text-base sm:text-lg font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-300 hover:border-blue-500 hover:shadow-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 bg-white dark:bg-gray-800" 
                                                                />
                                                            </InputOTPGroup>
                                                        </InputOTP>
                                                    </div>
                                                    
                                                    {/* Bouton pour afficher/masquer le code */}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={toggleShowCode}
                                                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full flex-shrink-0"
                                                        title={showCode ? "Masquer le code" : "Afficher le code"}
                                                    >
                                                        {showCode ? (
                                                            <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500" />
                                                        ) : (
                                                            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Messages d'état */}
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

                                {/* Boutons d'action */}
                                <div className="space-y-2 sm:space-y-3">
                                    <Button
                                        type="submit"
                                        disabled={isPending || attempts >= maxAttempts || timeLeft === 0}
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

                                    {/* Bouton de renvoi */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={resendCode}
                                        disabled={timeLeft > 0 || isPending}
                                        className="w-full h-9 sm:h-10 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl hover:border-blue-500 hover:text-blue-600 text-xs sm:text-sm"
                                    >
                                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                                            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${timeLeft > 0 ? 'animate-spin' : ''}`} />
                                            <span className="font-medium">
                                                {timeLeft > 0 ? `Renvoyer dans ${formatTime(timeLeft)}` : 'Renvoyer le code'}
                                            </span>
                                        </div>
                                    </Button>
                                </div>

                                {/* Aide */}
                                <div className="text-center text-xs text-gray-500 dark:text-gray-400 space-y-1.5 sm:space-y-2 bg-gray-50 dark:bg-gray-800/50 p-3 sm:p-4 rounded-xl">
                                    <div className="flex items-center justify-center space-x-1.5 sm:space-x-2">
                                        <Clock className="h-3 w-3 flex-shrink-0" />
                                        <p className="text-xs">Le code expire dans <span className="font-mono font-bold">{formatTime(timeLeft)}</span></p>
                                    </div>
                                    <p className="text-xs">Vérifiez votre dossier spam si vous ne recevez pas l'email</p>
                                </div>
                            </form>
                        </Form>
                    </div>
                </CardWrapper>
            </div>
        </div>
    )
}