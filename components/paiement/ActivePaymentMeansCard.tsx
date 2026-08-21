"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Printer, Smartphone, Landmark } from "lucide-react";
import { toast } from "sonner";
import { getActivePaymentAccountForMe } from "@/actions/payment-account-self";
import type { ActivePaymentAccountDto } from "@/lib/services/payment-accounts/types";

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copié`);
  } catch {
    toast.error("Copie impossible");
  }
}

/**
 * Affiche Wero + virement du compte actif association.
 */
export function ActivePaymentMeansCard({ reference }: { reference?: string }) {
  const [account, setAccount] = useState<ActivePaymentAccountDto | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getActivePaymentAccountForMe().then((res) => {
      if (res.success) setAccount(res.account ?? null);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;
  if (!account) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4 text-sm text-amber-900">
          Aucun compte de paiement configuré pour l&apos;association.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Moyens de paiement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {account.weroActif && account.telephoneWero ? (
          <div className="rounded-md border border-slate-200 p-3 space-y-2">
            <p className="font-semibold flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Wero
            </p>
            <p className="font-mono">{account.telephoneWero}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyText("Téléphone Wero", account.telephoneWero!)}
            >
              <Copy className="h-3 w-3 mr-1" /> Copier le numéro
            </Button>
          </div>
        ) : null}

        <div className="rounded-md border border-slate-200 p-3 space-y-2">
          <p className="font-semibold flex items-center gap-2">
            <Landmark className="h-4 w-4" /> Virement
          </p>
          <p>
            <span className="text-slate-500">Titulaire :</span> {account.titulaire}
          </p>
          <p className="font-mono break-all">
            <span className="text-slate-500">IBAN :</span> {account.iban}
          </p>
          <p className="font-mono">
            <span className="text-slate-500">BIC :</span> {account.bic}
          </p>
          {reference ? (
            <p className="font-mono text-xs">
              <span className="text-slate-500">Référence conseillée :</span>{" "}
              {reference}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyText("IBAN", account.iban)}
            >
              <Copy className="h-3 w-3 mr-1" /> Copier l&apos;IBAN
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyText("BIC", account.bic)}
            >
              <Copy className="h-3 w-3 mr-1" /> Copier le BIC
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <a href="/paiement/rib" target="_blank" rel="noreferrer">
                <Printer className="h-3 w-3 mr-1" /> Imprimer le RIB
              </a>
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Après virement ou Wero, joignez un justificatif. Le paiement sera
          vérifié par l&apos;association avant crédit.
        </p>
      </CardContent>
    </Card>
  );
}
