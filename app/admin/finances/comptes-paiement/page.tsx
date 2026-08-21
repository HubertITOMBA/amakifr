"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  Building2,
  Loader2,
  Plus,
  Pencil,
  Printer,
  ArrowLeft,
  Power,
  PowerOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adminCreateComptePaiement,
  adminDeactivateComptePaiement,
  adminListComptesPaiement,
  adminUpdateComptePaiement,
} from "@/actions/paiement-comptes";
import {
  maskIban,
  type ComptePaiementAssociationDto,
} from "@/lib/services/payment-accounts/types";

type FormState = {
  id?: string;
  libelle: string;
  titulaire: string;
  iban: string;
  bic: string;
  codeBanque: string;
  codeGuichet: string;
  numeroCompte: string;
  cleRib: string;
  telephoneWero: string;
  weroActif: boolean;
  actifPourPaiement: boolean;
};

const emptyForm = (): FormState => ({
  libelle: "",
  titulaire: "",
  iban: "",
  bic: "",
  codeBanque: "",
  codeGuichet: "",
  numeroCompte: "",
  cleRib: "",
  telephoneWero: "",
  weroActif: false,
  actifPourPaiement: false,
});

/**
 * Admin — comptes bancaires / Wero de l'association.
 */
export default function AdminComptesPaiementPage() {
  const [rows, setRows] = useState<ComptePaiementAssociationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminListComptesPaiement();
    if (res.success && res.data) {
      setRows(res.data);
      setForbidden(false);
    } else {
      const err = (res.error || "").toLowerCase();
      if (
        err.includes("autoris") ||
        err.includes("refus") ||
        err.includes("permission") ||
        err.includes("interdit")
      ) {
        setForbidden(true);
      }
      toast.error(res.error || "Erreur chargement");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (c: ComptePaiementAssociationDto) => {
    setForm({
      id: c.id,
      libelle: c.libelle,
      titulaire: c.titulaire,
      iban: c.iban,
      bic: c.bic,
      codeBanque: c.codeBanque ?? "",
      codeGuichet: c.codeGuichet ?? "",
      numeroCompte: c.numeroCompte ?? "",
      cleRib: c.cleRib ?? "",
      telephoneWero: c.telephoneWero ?? "",
      weroActif: c.weroActif,
      actifPourPaiement: c.actifPourPaiement,
    });
    setOpen(true);
  };

  const save = async () => {
    if (form.weroActif && !form.telephoneWero.trim()) {
      toast.error("Le téléphone Wero est obligatoire si Wero est activé");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      codeBanque: form.codeBanque || null,
      codeGuichet: form.codeGuichet || null,
      numeroCompte: form.numeroCompte || null,
      cleRib: form.cleRib || null,
      telephoneWero: form.telephoneWero || null,
    };
    const res = form.id
      ? await adminUpdateComptePaiement(payload)
      : await adminCreateComptePaiement(payload);
    setSaving(false);
    if (res.success) {
      toast.success(res.message || "Enregistré");
      setOpen(false);
      void load();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const deactivate = async (id: string) => {
    const res = await adminDeactivateComptePaiement(id);
    if (res.success) {
      toast.success(res.message || "Désactivé");
      void load();
    } else toast.error(res.error || "Erreur");
  };

  const activate = async (c: ComptePaiementAssociationDto) => {
    const res = await adminUpdateComptePaiement({
      id: c.id,
      actifPourPaiement: true,
    });
    if (res.success) {
      toast.success("Compte activé pour les adhérents");
      void load();
    } else toast.error(res.error || "Erreur");
  };

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
        <Card className="max-w-md shadow-lg border-red-200">
          <CardContent className="pt-6 space-y-3 text-center">
            <p className="font-semibold text-slate-900">Accès refusé</p>
            <p className="text-sm text-slate-600">
              Vous n&apos;avez pas la permission de gérer les comptes de
              paiement.
            </p>
            <Link href="/admin/finances">
              <Button variant="outline">Retour aux finances</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6">
      <div className="mb-4">
        <Link href="/admin/finances">
          <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
      </div>

      <Card className="mx-auto max-w-5xl w-full shadow-lg border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900 !py-0">
        <CardHeader className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 dark:from-blue-700 dark:via-blue-600 dark:to-blue-700 text-white pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold text-white">
              <Building2 className="h-5 w-5 shrink-0 text-white" />
              Comptes de paiement ({rows.length})
            </CardTitle>
            <Button
              onClick={openCreate}
              className="bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau compte
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6 px-4 sm:px-6 pb-6">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Un seul compte peut être actif pour les adhérents. La suppression
            physique n&apos;est pas proposée : préférez la désactivation.
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-6">
              Aucun compte configuré. Les adhérents verront qu&apos;aucun moyen
              de paiement n&apos;est disponible.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-lg border bg-white dark:bg-gray-950 p-4 shadow-sm ${
                    c.actifPourPaiement
                      ? "border-green-300 ring-1 ring-green-100"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {c.libelle}
                        </p>
                        {c.actifPourPaiement ? (
                          <span className="text-xs font-bold text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                            Compte actif
                          </span>
                        ) : null}
                        {c.weroActif ? (
                          <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            Wero actif
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        {c.titulaire}
                      </p>
                      <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                        IBAN {maskIban(c.iban)} · BIC {c.bic}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Wero actif : {c.weroActif ? "Oui" : "Non"}
                        {c.telephoneWero ? ` · ${c.telephoneWero}` : ""}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Actif pour paiements adhérents :{" "}
                        {c.actifPourPaiement ? "Oui" : "Non"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `/admin/finances/comptes-paiement/rib?id=${c.id}`,
                            "_blank"
                          )
                        }
                        title="Imprimer le RIB"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(c)}
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {c.actifPourPaiement ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-700 border-red-300 hover:bg-red-50"
                          onClick={() => void deactivate(c.id)}
                        >
                          <PowerOff className="h-4 w-4 mr-1" />
                          Désactiver
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => void activate(c)}
                        >
                          <Power className="h-4 w-4 mr-1" />
                          Activer
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 gap-0 sm:max-w-lg border-2 border-blue-200 dark:border-blue-800 shadow-lg">
          <DialogHeader className="shrink-0 rounded-none border-b border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 px-6 py-4">
            <DialogTitle className="text-lg font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
              {form.id ? (
                <>
                  <Pencil className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                  Modifier le compte
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                  Nouveau compte
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-blue-800 dark:text-blue-200">
              {form.id
                ? "Mettez à jour les coordonnées bancaires et les options Wero."
                : "Saisissez le RIB / Wero présenté aux adhérents pour les paiements."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
            {(
              [
                ["libelle", "Libellé interne"],
                ["titulaire", "Titulaire"],
                ["iban", "IBAN"],
                ["bic", "BIC (8 ou 11 caractères, ex. PSSTFRPP)"],
                ["codeBanque", "Code banque"],
                ["codeGuichet", "Code guichet"],
                ["numeroCompte", "N° compte"],
                ["cleRib", "Clé RIB"],
                ["telephoneWero", "Téléphone Wero"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label
                  htmlFor={`compte-${key}`}
                  className="text-xs font-semibold text-slate-700 uppercase tracking-wide"
                >
                  {label}
                </Label>
                <Input
                  id={`compte-${key}`}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  autoComplete="off"
                  className="bg-white dark:bg-gray-900"
                />
              </div>
            ))}
            <div className="flex items-center justify-between rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 px-3 py-2">
              <Label htmlFor="actif-paiement">
                Actif pour paiements adhérents
              </Label>
              <Switch
                id="actif-paiement"
                checked={form.actifPourPaiement}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, actifPourPaiement: v }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 px-3 py-2">
              <div>
                <Label htmlFor="wero-actif">Wero actif</Label>
                {form.weroActif && !form.telephoneWero.trim() ? (
                  <p className="text-xs text-red-600 mt-0.5">
                    Téléphone Wero obligatoire
                  </p>
                ) : null}
              </div>
              <Switch
                id="wero-actif"
                checked={form.weroActif}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, weroActif: v }))
                }
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-white dark:bg-gray-900">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
