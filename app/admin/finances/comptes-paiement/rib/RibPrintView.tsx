"use client";

import type { ComptePaiementAssociation } from "@prisma/client";
import { Button } from "@/components/ui/button";

type Props = {
  compte: ComptePaiementAssociation;
};

/**
 * Contenu RIB imprimable (window.print).
 */
export function RibPrintView({ compte }: Props) {
  return (
    <div className="min-h-screen bg-white p-8 text-slate-900 print:p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex justify-between items-start print:hidden">
          <h1 className="text-xl font-bold">Relevé d&apos;Identité Bancaire</h1>
          <Button onClick={() => window.print()}>Imprimer</Button>
        </div>
        <h1 className="text-xl font-bold hidden print:block">
          Relevé d&apos;Identité Bancaire — AMAKI
        </h1>
        <dl className="grid grid-cols-1 gap-3 text-sm border border-slate-300 rounded-lg p-6">
          <div>
            <dt className="font-semibold uppercase text-xs text-slate-500">
              Libellé
            </dt>
            <dd>{compte.libelle}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-xs text-slate-500">
              Titulaire
            </dt>
            <dd>{compte.titulaire}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-xs text-slate-500">
              IBAN
            </dt>
            <dd className="font-mono tracking-wide">{compte.iban}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-xs text-slate-500">
              BIC
            </dt>
            <dd className="font-mono">{compte.bic}</dd>
          </div>
          {(compte.codeBanque ||
            compte.codeGuichet ||
            compte.numeroCompte ||
            compte.cleRib) && (
            <div className="grid grid-cols-4 gap-2 pt-2 border-t">
              <div>
                <dt className="text-xs text-slate-500">Banque</dt>
                <dd className="font-mono">{compte.codeBanque ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Guichet</dt>
                <dd className="font-mono">{compte.codeGuichet ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Compte</dt>
                <dd className="font-mono">{compte.numeroCompte ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Clé</dt>
                <dd className="font-mono">{compte.cleRib ?? "—"}</dd>
              </div>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
