"use client"

import { useForm } from 'react-hook-form'
import { useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from '@/schemas';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form"
import Link from "next/link"
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { CardWrapper } from "@/components/auth/card-wrapper"
import { FormError } from '@/components/global/form-error';
import { FormSuccess } from '@/components/global/form-success';
import { login } from '@/actions/auth/login';
import { useSession } from "next-auth/react";
import { RegisterButton } from "@/components/auth/register-button";
import { ResetButton } from "@/components/auth/reset-button";


const LoginForm = () => {

    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [ isPending, startTransition ] = useTransition()
    const [ showTwoFactor, setShowTwoFactor ] = useState(false)

    const searchParams = useSearchParams();
    const router = useRouter();
    const { update: updateSession } = useSession();
    const urlError = searchParams.get("error") === "OAuthAccountNotLinked"
    ? "E-mail déjà utilisé avec un autre fournisseur !"
    : ""; 

    const form = useForm<z.infer<typeof LoginSchema>> ({ 
        resolver: zodResolver(LoginSchema),
        defaultValues: {
            email: '',
            password: ''
        }
    })

    const onSubmit = (data: z.infer<typeof LoginSchema>) => {
      setError("");
      setSuccess("");
      startTransition(async () => {
        try {
          const result = await login(data, null); // Ne plus utiliser callbackUrl
          
          if (result?.error) {
            setError(result.error);
            form.reset();
          } else if (result?.success) {
            // Si twoFactor est activé, rediriger vers la page de vérification
            if (result.twoFactor) {
              setSuccess(result.success);
              setShowTwoFactor(true);
            } else {
              // Connexion réussie - forcer la mise à jour de la session
              setSuccess("Connexion réussie !");
              
              // Attendre un peu pour que la session soit créée côté serveur
              await new Promise(resolve => setTimeout(resolve, 500));
              
              try {
                // Mettre à jour la session une seule fois
                await updateSession();
              } catch (sessionError) {
                // Ignorer les erreurs de session, continuer quand même
                console.warn("[login-form] Erreur lors de la mise à jour de la session:", sessionError);
              }
              
              // Rafraîchir le routeur pour mettre à jour les données serveur
              router.refresh();
              
              // Attendre un peu pour que la session soit propagée
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Rediriger vers la page d'accueil après la connexion
              // Utiliser window.location.href pour forcer un rechargement complet de la page
              // Cela garantit que la session est correctement chargée et que le middleware
              // peut correctement détecter l'utilisateur connecté
              try {
                window.location.href = "/?loggedIn=true";
              } catch (redirectError) {
                // Si la redirection échoue, utiliser router.push en dernier recours
                console.warn("[login-form] Erreur lors de la redirection, utilisation de router.push:", redirectError);
                router.push("/?loggedIn=true");
              }
            }
          }
        } catch (error: any) {
          // Gérer les erreurs de manière plus robuste
          console.error("Erreur de connexion:", error);
          
          // Vérifier si c'est une erreur de redirection Next.js (qui est normale)
          if (error?.digest?.startsWith('NEXT_REDIRECT') || 
              error?.message?.includes('NEXT_REDIRECT') ||
              error?.code === 'NEXT_REDIRECT' ||
              error?.name === 'NEXT_REDIRECT') {
            // C'est une redirection normale, ne pas afficher d'erreur
            setSuccess("Connexion réussie !");
            router.refresh();
            setTimeout(() => {
              window.location.href = "/?loggedIn=true";
            }, 300);
            return;
          }
          
          // Pour les autres erreurs, afficher un message
          setError(error?.message || "Une erreur s'est produite lors de la connexion !");
        }
      });
    }

    if(showTwoFactor){
      router.push('/auth/new-verification');
      return null;
  }
  
  return (
        <CardWrapper
            labelBox= "Connexion"
            headerLabel="Content de vous revoir !"
            backButtonLabel="Nouvel adhérent ? Commencez ici"
            backButtonComponent={
                <RegisterButton mode="modal">
                    <Button
                        variant="link"
                        size="sm"
                        type="button"
                        className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-normal"
                    >
                        Nouvel adhérent ? Commencez ici
                    </Button>
                </RegisterButton>
            }
            showSocial
            >
            <Form {...form}>
              <form 
                onSubmit={form.handleSubmit(onSubmit)}
                className="border-à space-y-6"
              >
                  <div className="space-y-4">
                    {/* { showTwoFactor && (
                      <FormField
                          control={form.control}
                          name="code"
                          render={({ field }) => (
                          <FormItem>
                              <FormLabel>Votre Code d'identification</FormLabel>
                              <FormControl>
                              <Input
                                  {...field}
                                  disabled={isPending}
                                  placeholder="123456"
                              />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                    )}
                    { !showTwoFactor && (
                    <>              */}
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

                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Mot de passe</FormLabel>
                                  <FormControl>
                                      <PasswordInput 
                                          {...field}
                                          disabled={isPending}
                                          placeholder=""
                                      />
                                  </FormControl>
                                  <ResetButton mode="modal">
                                      <Button
                                          size="sm"
                                          variant="link"
                                          type="button"
                                          className="px-0 font-normal text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                                      >
                                          Mot de passe oublié ?
                                      </Button>
                                  </ResetButton>
                              </FormItem>
                        )}
                    />
                    {/* </>    */}
                  
                    
                
                  </div> 
                    <FormError message={error || urlError}/>
                    <FormSuccess message={success}/>
                    <Button
                        disabled={isPending}
                        type="submit"
                        className="w-full"
                      >
                        Connexion
                      {/* { showTwoFactor ? "Confirmer" : "Connexion" }   */}
                    </Button>
              </form>
            </Form>
          </CardWrapper>
  )
}
export default LoginForm 

 