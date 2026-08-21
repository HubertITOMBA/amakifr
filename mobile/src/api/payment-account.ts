/**
 * Client API compte de paiement actif + déclaration virement/Wero.
 */

import { fetch as expoFetch } from "expo/fetch";
import { authenticatedFetch } from "@/auth/session";
import type { ActivePaymentAccountDto } from "@/api/payment-account-state";
import {
  appendJustificatifToFormData,
  buildReactNativeFilePart,
  uriSchemeForLog,
} from "@/api/react-native-form-data-file";

export type { ActivePaymentAccountDto };

export type DeclaredPaymentDto = {
  id: string;
  montant: string;
  moyenPaiement: string;
  reference: string;
  statut: string;
  targetType: string;
  targetId: string;
  message: string;
};

/**
 * GET /api/v1/me/payment-account
 */
export async function getActivePaymentAccount(): Promise<ActivePaymentAccountDto | null> {
  const data = await authenticatedFetch<{
    account: ActivePaymentAccountDto | null;
  }>("/api/v1/me/payment-account");
  return data.account ?? null;
}

export type DeclarePaymentInput = {
  targetType:
    | "cotisation-mensuelle"
    | "dette-initiale"
    | "assistance"
    | "obligation";
  targetId: string;
  amount: string;
  paymentMethod: "Virement" | "Wero";
  justificatifUri: string;
  justificatifName: string;
  justificatifMime: string;
  /** Taille fichier côté client (diagnostic __DEV__ uniquement). */
  justificatifSize?: number | null;
};

const MULTIPART_DIAG_TIMEOUT_MS = 15_000;

/**
 * POST multipart /api/v1/me/payments/bank-transfer
 * FormData brut (jamais JSON.stringify). Champs autorisés uniquement.
 *
 * Transport : expo/fetch (Winter) — requis pour FormData + File Expo.
 * Timeout diagnostic 15s (ne change pas les timeouts globaux).
 */
export async function declareBankOrWeroPayment(
  input: DeclarePaymentInput
): Promise<DeclaredPaymentDto> {
  const filePart = buildReactNativeFilePart({
    uri: input.justificatifUri,
    name: input.justificatifName,
    mimeType: input.justificatifMime,
  });

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console
    console.log("[MOBILE_PAYMENT] request start");
    // eslint-disable-next-line no-console
    console.log(
      `[MOBILE_PAYMENT] file uri scheme=${uriSchemeForLog(filePart.uri)}`
    );
    // eslint-disable-next-line no-console
    console.log(`[MOBILE_PAYMENT] file type=${filePart.type}`);
    // eslint-disable-next-line no-console
    console.log(
      `[MOBILE_PAYMENT] file size=${input.justificatifSize ?? "unknown"}`
    );
  }

  const form = new FormData();
  form.append("targetType", input.targetType);
  form.append("targetId", input.targetId);
  form.append("amount", input.amount);
  form.append("paymentMethod", input.paymentMethod);

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[MOBILE_PAYMENT] targetType=${input.targetType}`);
    // eslint-disable-next-line no-console
    console.log(
      `[MOBILE_PAYMENT] targetIdType=${typeof input.targetId}`
    );
    // eslint-disable-next-line no-console
    console.log(`[MOBILE_PAYMENT] paymentMethod=${input.paymentMethod}`);
  }

  await appendJustificatifToFormData(form, "justificatif", filePart);

  try {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.log("[MOBILE_PAYMENT] before authenticatedFetch");
    }

    const data = await authenticatedFetch<DeclaredPaymentDto>(
      "/api/v1/me/payments/bank-transfer",
      {
        method: "POST",
        body: form,
        fetchImpl: expoFetch as unknown as typeof fetch,
        timeoutMs: MULTIPART_DIAG_TIMEOUT_MS,
      }
    );

    if (typeof __DEV__ !== "undefined" && __DEV__) {
      // eslint-disable-next-line no-console
      console.log("[MOBILE_PAYMENT] after authenticatedFetch success");
    }
    return data;
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      const detail =
        error instanceof Error ? error.message : String(error ?? "unknown");
      // eslint-disable-next-line no-console
      console.warn("[MOBILE_PAYMENT] request failed", detail);
      // eslint-disable-next-line no-console
      console.log(
        `[MOBILE_PAYMENT] after authenticatedFetch status/success=fail`
      );
    }
    throw error;
  }
}
