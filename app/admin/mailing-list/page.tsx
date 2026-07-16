"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  Download,
  Loader2,
  Mail,
  Search,
  Users,
  FileType,
  MapPin,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  generateMailingListDocument,
  getMailingListRecipients,
} from "@/actions/admin/mailing-list";
import { MAILING_LIST_PLACEHOLDERS } from "@/lib/mailing-list";
import { plainTextToMailingHtml } from "@/lib/mailing-list-html";
import { RichTextEditor } from "@/components/admin/rapports-reunion/RichTextEditor";

type RecipientRow = {
  adherentId: string;
  civilite: string;
  prenom: string;
  nom: string;
  nomComplet: string;
  adresseLigne1: string;
  codePostal: string;
  ville: string;
  email?: string;
  hasCompleteAddress: boolean;
};

const DEFAULT_CORPS_PLAIN = `{{civilite}} {{nomComplet}},

Nous avons le plaisir de vous adresser les informations suivantes de la part de l'association AMAKI France.

[Votre texte ici]

Nous vous prions d'agréer, {{civilite}}, l'expression de nos salutations distinguées.`;

const DEFAULT_CORPS = plainTextToMailingHtml(DEFAULT_CORPS_PLAIN);

/**
 * Page admin : courriers postaux mailing list (PDF / Word)
 */
export default function AdminMailingListPage() {
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<"pdf" | "docx" | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [objet, setObjet] = useState("Information de l'association AMAKI France");
  const [lieu, setLieu] = useState("Paris");
  const [corps, setCorps] = useState(DEFAULT_CORPS);

  const loadRecipients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMailingListRecipients();
      if (!res.success || !res.data) {
        toast.error(res.error || "Erreur lors du chargement");
        return;
      }
      setRecipients(res.data);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des adhérents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  const filteredRecipients = useMemo(() => {
    if (!searchTerm.trim()) return recipients;
    const q = searchTerm.toLowerCase().trim();
    return recipients.filter((r) =>
      [r.nomComplet, r.adresseLigne1, r.codePostal, r.ville, r.email || ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [recipients, searchTerm]);

  const eligibleCount = useMemo(
    () => recipients.filter((r) => r.hasCompleteAddress).length,
    [recipients]
  );

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    );
  };

  const selectAllFiltered = () => {
    const ids = filteredRecipients
      .filter((r) => r.hasCompleteAddress)
      .map((r) => r.adherentId);
    setSelectedIds(ids);
    toast.info(`${ids.length} adhérent(s) sélectionné(s)`);
  };

  const clearSelection = () => setSelectedIds([]);

  const insertPlaceholder = (key: string) => {
    setCorps((c) => `${c}${key}`);
  };

  const handleGenerate = async (format: "pdf" | "docx") => {
    if (!objet.trim() || !corps.trim()) {
      toast.warning("Renseignez l'objet et le corps du courrier");
      return;
    }
    if (selectedIds.length === 0) {
      toast.warning("Sélectionnez au moins un destinataire");
      return;
    }

    setGenerating(format);
    try {
      const formData = new FormData();
      formData.append("objet", objet.trim());
      formData.append("corps", corps.trim());
      formData.append("lieu", lieu.trim() || "Paris");
      formData.append("format", format);
      selectedIds.forEach((id) => formData.append("adherentIds", id));

      const res = await generateMailingListDocument(formData);
      if (!res.success || !res.data || !res.fileName) {
        toast.error(res.error || "Échec de la génération");
        return;
      }

      const link = document.createElement("a");
      link.href = res.data;
      link.download = res.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(
        `Document ${format.toUpperCase()} généré (${selectedIds.length} courrier${selectedIds.length > 1 ? "s" : ""})`
      );
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la génération");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6">
      <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-blue-800">
        <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 dark:from-blue-600/90 dark:to-blue-700/90 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Mail className="h-5 w-5 sm:h-6 sm:w-6" />
                Courriers postaux ({eligibleCount})
              </CardTitle>
              <p className="text-blue-100 text-xs sm:text-sm mt-1 max-w-2xl">
                Rédigez un courrier personnalisé avec mise en forme, sélectionnez les adhérents
                et exportez en PDF ou Word. En-tête AMAKI avec logo, comme les e-mails.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleGenerate("pdf")}
                disabled={generating !== null}
                className="bg-white text-blue-700 hover:bg-blue-50 shadow-sm"
              >
                {generating === "pdf" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Exporter PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => handleGenerate("docx")}
                disabled={generating !== null}
                className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                {generating === "docx" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileType className="h-4 w-4 mr-2" />
                )}
                Exporter Word
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Formulaire courrier */}
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="objet">Objet du courrier *</Label>
                  <Input
                    id="objet"
                    value={objet}
                    onChange={(e) => setObjet(e.target.value)}
                    className="mt-1"
                    placeholder="Objet affiché sur le courrier"
                  />
                </div>
                <div>
                  <Label htmlFor="lieu" className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Lieu (ville et date)
                  </Label>
                  <Input
                    id="lieu"
                    value={lieu}
                    onChange={(e) => setLieu(e.target.value)}
                    className="mt-1"
                    placeholder="Paris"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Affiché à droite : « {lieu || "Paris"}, le … »
                  </p>
                </div>
              </div>

              <div>
                <Label>Corps du courrier *</Label>
                <div className="mt-1">
                  <RichTextEditor
                    value={corps}
                    onChange={setCorps}
                    placeholder="Rédigez votre courrier ici…"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Variables disponibles (cliquez pour insérer) :
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {MAILING_LIST_PLACEHOLDERS.map((p) => (
                    <Badge
                      key={p.key}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      onClick={() => insertPlaceholder(p.key)}
                    >
                      {p.key}
                    </Badge>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground border-t border-slate-200 dark:border-slate-700 pt-3">
                Un courrier par page (PDF) ou par section (Word). Adresse destinataire, date et
                signature alignées à droite. En-tête bleu avec logo AMAKI.
              </p>
            </div>

            {/* Sélection destinataires */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4" />
                  Destinataires ({selectedIds.length} sélectionné
                  {selectedIds.length > 1 ? "s" : ""})
                </Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                    Tout sélectionner
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                    Effacer
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher nom, adresse, ville..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="border rounded-lg max-h-[520px] overflow-y-auto divide-y dark:divide-slate-700 border-slate-200 dark:border-slate-700">
                  {filteredRecipients.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">
                      Aucun adhérent avec adresse postale
                    </p>
                  ) : (
                    filteredRecipients.map((r) => {
                      const checked = selectedIds.includes(r.adherentId);
                      return (
                        <label
                          key={r.adherentId}
                          className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                            !r.hasCompleteAddress ? "opacity-60" : ""
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            disabled={!r.hasCompleteAddress}
                            onCheckedChange={(v) => toggleOne(r.adherentId, v === true)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">
                              {r.civilite} {r.prenom} {r.nom}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {r.adresseLigne1}
                              {r.codePostal || r.ville
                                ? ` — ${[r.codePostal, r.ville].filter(Boolean).join(" ")}`
                                : ""}
                            </p>
                            {!r.hasCompleteAddress && (
                              <Badge variant="destructive" className="text-[10px] mt-1">
                                Adresse incomplète
                              </Badge>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Download className="h-3 w-3" />
                {recipients.length} adhérent(s) avec adresse enregistrée
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
