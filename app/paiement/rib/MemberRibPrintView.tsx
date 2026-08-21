"use client";

import { Button } from "@/components/ui/button";
import type { ActivePaymentAccountDto } from "@/lib/services/payment-accounts/types";

/**
 * Vue RIB adhérent (compte actif uniquement).
 */
export function MemberRibPrintView({
  account,
}: {
  account: ActivePaymentAccountDto;
}) {
  return (
    <div className="min-h-screen bg-white p-8 text-slate-900">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex justify-between items-start print:hidden">
          <h1 className="text-xl font-bold">RIB — AMAKI</h1>
          <Button onClick={() => window.print()}>Imprimer</Button>
        </div>
        <dl className="grid gap-3 text-sm border rounded-lg p-6">
          <div>
            <dt className="text-xs uppercase text-slate-500">Libellé</dt>
            <dd>{account.libelle}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Titulaire</dt>
            <dd>{account.titulaire}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">IBAN</dt>
            <dd className="font-mono">{account.iban}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">BIC</dt>
            <dd className="font-mono">{account.bic}</dd>
          </div>
          <div className="grid grid-cols-4 gap-2 border-t pt-2">
            <div>
              <dt className="text-xs text-slate-500">Banque</dt>
              <dd className="font-mono">{account.codeBanque ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Guichet</dt>
              <dd className="font-mono">{account.codeGuichet ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Compte</dt>
              <dd className="font-mono">{account.numeroCompte ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Clé</dt>
              <dd className="font-mono">{account.cleRib ?? "—"}</dd>
            </div>
          </div>
        </dl>
      </div>
    </div>
  );
}
