"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Settings, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface RelanceAutomatiqueConfigProps {
  config: {
    actif: boolean;
    premiereRelanceJours: number;
    deuxiemeRelanceJours: number;
    relanceUrgenteJours: number;
    exclusionAdherentsAJour: boolean;
  };
  onSave?: (config: typeof config) => Promise<void>;
}

export function RelanceAutomatiqueConfig({ config: initialConfig, onSave }: RelanceAutomatiqueConfigProps) {
  const [config, setConfig] = useState(initialConfig);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;

    try {
      setLoading(true);
      await onSave(config);
      toast.success("Configuration sauvegardée avec succès");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde de la configuration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="!py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900">
      <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg">
        <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
          <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400" />
          <span>Configuration des Relances Automatiques</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm mt-1">
          Configurez les paramètres d'envoi automatique des relances
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-6">
        {/* Activation */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="actif" className="text-sm font-medium">
              Activer les relances automatiques
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Les relances seront envoyées automatiquement selon le calendrier configuré
            </p>
          </div>
          <Switch
            id="actif"
            checked={config.actif}
            onCheckedChange={(checked) => setConfig({ ...config, actif: checked })}
          />
        </div>

        {/* Jours pour première relance */}
        <div className="space-y-2">
          <Label htmlFor="premiereRelanceJours" className="text-sm font-medium">
            Jours après échéance pour la 1ère relance
          </Label>
          <Input
            id="premiereRelanceJours"
            type="number"
            min="0"
            value={config.premiereRelanceJours}
            onChange={(e) =>
              setConfig({ ...config, premiereRelanceJours: parseInt(e.target.value) || 0 })
            }
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            La première relance sera envoyée X jours après la date d'échéance
          </p>
        </div>

        {/* Jours pour deuxième relance */}
        <div className="space-y-2">
          <Label htmlFor="deuxiemeRelanceJours" className="text-sm font-medium">
            Jours après échéance pour la 2ème relance
          </Label>
          <Input
            id="deuxiemeRelanceJours"
            type="number"
            min="0"
            value={config.deuxiemeRelanceJours}
            onChange={(e) =>
              setConfig({ ...config, deuxiemeRelanceJours: parseInt(e.target.value) || 0 })
            }
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            La deuxième relance sera envoyée X jours après la date d'échéance
          </p>
        </div>

        {/* Jours pour relance urgente */}
        <div className="space-y-2">
          <Label htmlFor="relanceUrgenteJours" className="text-sm font-medium">
            Jours après échéance pour la relance urgente
          </Label>
          <Input
            id="relanceUrgenteJours"
            type="number"
            min="0"
            value={config.relanceUrgenteJours}
            onChange={(e) =>
              setConfig({ ...config, relanceUrgenteJours: parseInt(e.target.value) || 0 })
            }
            className="w-full"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            La relance urgente sera envoyée X jours après la date d'échéance
          </p>
        </div>

        {/* Exclusion adhérents à jour */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="exclusionAdherentsAJour" className="text-sm font-medium">
              Exclure les adhérents à jour
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ne pas envoyer de relances aux adhérents qui n'ont pas de dette
            </p>
          </div>
          <Switch
            id="exclusionAdherentsAJour"
            checked={config.exclusionAdherentsAJour}
            onCheckedChange={(checked) => setConfig({ ...config, exclusionAdherentsAJour: checked })}
          />
        </div>

        {/* Bouton de sauvegarde */}
        {onSave && (
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder la configuration
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

