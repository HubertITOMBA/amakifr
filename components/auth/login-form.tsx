"use client"

import { useForm } from "react-hook-form"
import { useState, useTransition } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { LoginSchema } from "@/schemas"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CardWrapper } from "@/components/auth/card-wrapper"
import { FormError } from "@/components/global/form-error"
import { FormSuccess } from "@/components/global/form-success"
import { login } from "@/actions/auth/login"
import { useSession } from "next-auth/react"
import { RegisterButton } from "@/components/auth/register-button"
import { ResetButton } from "@/components/auth/reset-button"
import { toast } from "react-toastify"

export default function LoginForm() {
  const [error, setError] = useState<string | undefined>("")
  const [success, setSuccess] = useState<string | undefined>("")
  const [isPending, startTransition] = useTransition()
  const [showTwoFactor, setShowTwoFactor] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const { update: updateSession } = useSession()
  const urlError =
    searchParams.get("error") === "OAuthAccountNotLinked"
      ? "E-mail déjà utilisé avec un autre fournisseur !"
      : ""

  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = (data: z.infer<typeof LoginSchema>) => {
    setError("")
    setSuccess("")
    startTransition(async () => {
      try {
        const result = await login(data, null)

        if (result?.error) {
          setError(result.error)
          toast.error(result.error, { position: "top-center", autoClose: 5000 })
          form.reset()
          return
        }

        if (result?.success) {
          if (result.twoFactor) {
            setSuccess(result.success)
            setShowTwoFactor(true)
            return
          }

          setSuccess("Connexion réussie !")
          await new Promise((r) => setTimeout(r, 500))

          try {
            await updateSession()
          } catch (sessionError) {
            console.warn("[login-form] Erreur session:", sessionError)
          }

          router.refresh()
          await new Promise((r) => setTimeout(r, 300))

          try {
            window.location.href = "/?loggedIn=true"
          } catch {
            router.push("/?loggedIn=true")
          }
        }
      } catch (err: unknown) {
        console.error("Erreur de connexion:", err)
        const errObj = err as {
          digest?: string
          message?: string
          code?: string
          name?: string
        }
        if (
          errObj?.digest?.startsWith("NEXT_REDIRECT") ||
          errObj?.message?.includes("NEXT_REDIRECT") ||
          errObj?.code === "NEXT_REDIRECT" ||
          errObj?.name === "NEXT_REDIRECT"
        ) {
          setSuccess("Connexion réussie !")
          router.refresh()
          setTimeout(() => {
            window.location.href = "/?loggedIn=true"
          }, 300)
          return
        }
        setError(
          (errObj?.message as string) ||
            "Une erreur s'est produite lors de la connexion !"
        )
      }
    })
  }

  if (showTwoFactor) {
    router.push("/auth/new-verification")
    return null
  }

  return (
    <CardWrapper
      labelBox="Connexion"
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
                      autoComplete="email"
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
                    <Input
                      {...field}
                      disabled={isPending}
                      placeholder=""
                      type="password"
                      autoComplete="current-password"
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormError message={error || urlError} />
          <FormSuccess message={success} />
          <Button disabled={isPending} type="submit" className="w-full">
            Connexion
          </Button>
        </form>
      </Form>
    </CardWrapper>
  )
}
