"use client";

import type { Control } from "react-hook-form";
import type * as z from "zod";
import { RegisterSchema } from "@/schemas";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
  useFormField,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

type RegisterValues = z.infer<typeof RegisterSchema>;

type RegisterAcceptConditionsFieldProps = {
  control: Control<RegisterValues>;
  disabled?: boolean;
  onOpenConditions: () => void;
  onOpenStatut: () => void;
  /** Variante de libellé (page inscription vs modal). */
  variant?: "default" | "compact";
};

function AcceptConditionsLabel({
  variant,
  onOpenConditions,
  onOpenStatut,
}: {
  variant: "default" | "compact";
  onOpenConditions: () => void;
  onOpenStatut: () => void;
}) {
  const { formItemId } = useFormField();
  return (
    <label
      htmlFor={formItemId}
      className={
        variant === "compact"
          ? "cursor-pointer text-xs leading-relaxed text-gray-800 dark:text-gray-200"
          : "cursor-pointer text-xs leading-relaxed text-gray-600 dark:text-gray-400"
      }
    >
      En créant un compte, vous acceptez les{" "}
      <button
        type="button"
        onClick={onOpenConditions}
        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        conditions d&apos;adhésion et d&apos;utilisation d&apos;Amaki France
      </button>
      . Consultez notre{" "}
      <button
        type="button"
        onClick={onOpenStatut}
        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        statut juridique
      </button>{" "}
      et notre{" "}
      <button
        type="button"
        onClick={onOpenConditions}
        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        déclaration de confidentialité
      </button>
      .
    </label>
  );
}

/**
 * Case d’acceptation des conditions pour l’inscription web.
 * Ouvrir les documents ne coche pas automatiquement la case.
 */
export function RegisterAcceptConditionsField({
  control,
  disabled = false,
  onOpenConditions,
  onOpenStatut,
  variant = "default",
}: RegisterAcceptConditionsFieldProps) {
  return (
    <FormField
      control={control}
      name="acceptConditions"
      render={({ field, fieldState }) => {
        const invalid = Boolean(fieldState.error);
        return (
          <FormItem
            className={
              invalid
                ? "space-y-2 rounded-md border-2 border-red-300 bg-red-50/80 p-3 dark:border-red-700 dark:bg-red-950/30"
                : "space-y-2 rounded-md border-2 border-blue-200 bg-blue-50/60 p-3 dark:border-blue-800 dark:bg-blue-950/20"
            }
          >
            <div className="flex items-start gap-2">
              <FormControl>
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={(checked) =>
                    field.onChange(checked === true)
                  }
                  disabled={disabled}
                  className="mt-1"
                />
              </FormControl>
              <AcceptConditionsLabel
                variant={variant}
                onOpenConditions={onOpenConditions}
                onOpenStatut={onOpenStatut}
              />
            </div>
            <FormDescription className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Cochez cette case pour créer votre compte.
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
