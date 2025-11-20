"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Save, Info } from "lucide-react";
import { RELANCE_VARIABLES } from "@/lib/relances/constants";

interface RelanceTemplateEditorProps {
  template?: {
    nom: string;
    niveau: "Premiere" | "Deuxieme" | "Urgente";
    sujet: string;
    contenu: string;
    joursApresEcheance: number;
  };
  onSave?: (template: {
    nom: string;
    niveau: "Premiere" | "Deuxieme" | "Urgente";
    sujet: string;
    contenu: string;
    joursApresEcheance: number;
  }) => Promise<void>;
}

export function RelanceTemplateEditor({ template, onSave }: RelanceTemplateEditorProps) {
  const [formData, setFormData] = useState({
    nom: template?.nom || "",
    niveau: (template?.niveau || "Premiere") as "Premiere" | "Deuxieme" | "Urgente",
    sujet: template?.sujet || "",
    contenu: template?.contenu || "",
    joursApresEcheance: template?.joursApresEcheance || 15,
  });

  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;

    if (!formData.nom || !formData.sujet || !formData.contenu) {
      return;
    }

    try {
      setLoading(true);
      await onSave(formData);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable: string) => {
    setFormData({
      ...formData,
      contenu: formData.contenu + variable,
    });
  };

  return (
    <Card className="!py-0 border-2 border-purple-200 dark:border-purple-800/50 bg-white dark:bg-gray-900">
      <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 rounded-t-lg">
        <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 dark:text-purple-400" />
          <span>Éditeur de Template de Relance</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm mt-1">
          Créez ou modifiez un template de relance avec variables dynamiques
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-6">
        {/* Nom du template */}
        <div className="space-y-2">
          <Label htmlFor="nom" className="text-sm font-medium">
            Nom du template
          </Label>
          <Input
            id="nom"
            value={formData.nom}
            onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
            placeholder="Ex: Relance première - Cotisation mensuelle"
            className="w-full"
          />
        </div>

        {/* Niveau */}
        <div className="space-y-2">
          <Label htmlFor="niveau" className="text-sm font-medium">
            Niveau de relance
          </Label>
          <Select
            value={formData.niveau}
            onValueChange={(value) =>
              setFormData({ ...formData, niveau: value as "Premiere" | "Deuxieme" | "Urgente" })
            }
          >
            <SelectTrigger id="niveau">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Premiere">Première relance</SelectItem>
              <SelectItem value="Deuxieme">Deuxième relance</SelectItem>
              <SelectItem value="Urgente">Relance urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Jours après échéance */}
        <div className="space-y-2">
          <Label htmlFor="joursApresEcheance" className="text-sm font-medium">
            Jours après échéance
          </Label>
          <Input
            id="joursApresEcheance"
            type="number"
            min="0"
            value={formData.joursApresEcheance}
            onChange={(e) =>
              setFormData({ ...formData, joursApresEcheance: parseInt(e.target.value) || 0 })
            }
            className="w-full"
          />
        </div>

        {/* Sujet */}
        <div className="space-y-2">
          <Label htmlFor="sujet" className="text-sm font-medium">
            Sujet de l'email
          </Label>
          <Input
            id="sujet"
            value={formData.sujet}
            onChange={(e) => setFormData({ ...formData, sujet: e.target.value })}
            placeholder="Ex: Relance de paiement - {PRENOM} {NOM}"
            className="w-full"
          />
        </div>

        {/* Variables disponibles */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Info className="h-4 w-4" />
            Variables disponibles
          </Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(RELANCE_VARIABLES).map(([variable, description]) => (
              <Badge
                key={variable}
                variant="outline"
                className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20"
                onClick={() => insertVariable(variable)}
                title={description}
              >
                {variable}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cliquez sur une variable pour l'insérer dans le contenu
          </p>
        </div>

        {/* Contenu */}
        <div className="space-y-2">
          <Label htmlFor="contenu" className="text-sm font-medium">
            Contenu de l'email
          </Label>
          <Textarea
            id="contenu"
            value={formData.contenu}
            onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
            placeholder="Bonjour {PRENOM} {NOM},&#10;&#10;Votre cotisation de {MONTANT} € est en retard..."
            rows={10}
            className="w-full font-mono text-sm"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Utilisez les variables entre accolades pour personnaliser le message
          </p>
        </div>

        {/* Bouton de sauvegarde */}
        {onSave && (
          <Button onClick={handleSave} disabled={loading || !formData.nom || !formData.sujet || !formData.contenu} className="w-full">
            {loading ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder le template
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

