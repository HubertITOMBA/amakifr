"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface NotificationPreferencesData {
  // Canaux de notification
  email: boolean;
  inApp: boolean;
  sms: boolean; // Pour l'avenir

  // Fréquence
  frequence: "immediat" | "quotidien" | "hebdomadaire";

  // Types de notifications
  notificationsEvenements: boolean;
  notificationsElections: boolean;
  notificationsCotisations: boolean;
  notificationsDocuments: boolean;
  notificationsBadges: boolean;
  notificationsIdees: boolean;
}

interface NotificationPreferencesProps {
  preferences?: NotificationPreferencesData;
  onSave?: (preferences: NotificationPreferencesData) => Promise<void>;
}

const defaultPreferences: NotificationPreferencesData = {
  email: true,
  inApp: true,
  sms: false,
  frequence: "immediat",
  notificationsEvenements: true,
  notificationsElections: true,
  notificationsCotisations: true,
  notificationsDocuments: true,
  notificationsBadges: true,
  notificationsIdees: true,
};

export function NotificationPreferences({
  preferences: initialPreferences,
  onSave,
}: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreferencesData>(
    initialPreferences || defaultPreferences
  );
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;

    try {
      setLoading(true);
      await onSave(preferences);
      toast.success("Préférences sauvegardées avec succès");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde des préférences");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="!py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900">
      <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg">
        <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400" />
          <span>Préférences de Notifications</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm mt-1">
          Configurez comment et quand vous recevez les notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-6">
        {/* Canaux de notification */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Canaux de notification</Label>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Recevoir les notifications par email
              </p>
            </div>
            <Switch
              id="email"
              checked={preferences.email}
              onCheckedChange={(checked) => setPreferences({ ...preferences, email: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inApp" className="text-sm font-medium">
                Notifications in-app
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Afficher les notifications dans l'application
              </p>
            </div>
            <Switch
              id="inApp"
              checked={preferences.inApp}
              onCheckedChange={(checked) => setPreferences({ ...preferences, inApp: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sms" className="text-sm font-medium">
                SMS (Bientôt disponible)
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Recevoir les notifications par SMS
              </p>
            </div>
            <Switch
              id="sms"
              checked={preferences.sms}
              onCheckedChange={(checked) => setPreferences({ ...preferences, sms: checked })}
              disabled
            />
          </div>
        </div>

        {/* Fréquence */}
        <div className="space-y-2">
          <Label htmlFor="frequence" className="text-sm font-semibold">
            Fréquence de réception
          </Label>
          <Select
            value={preferences.frequence}
            onValueChange={(value) =>
              setPreferences({
                ...preferences,
                frequence: value as "immediat" | "quotidien" | "hebdomadaire",
              })
            }
          >
            <SelectTrigger id="frequence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediat">Immédiat</SelectItem>
              <SelectItem value="quotidien">Quotidien (résumé)</SelectItem>
              <SelectItem value="hebdomadaire">Hebdomadaire (résumé)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {preferences.frequence === "immediat"
              ? "Vous recevrez chaque notification dès qu'elle est créée"
              : preferences.frequence === "quotidien"
              ? "Vous recevrez un résumé quotidien de toutes les notifications"
              : "Vous recevrez un résumé hebdomadaire de toutes les notifications"}
          </p>
        </div>

        {/* Types de notifications */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Types de notifications</Label>

          <div className="flex items-center justify-between">
            <Label htmlFor="notificationsEvenements" className="text-sm font-medium">
              Événements
            </Label>
            <Switch
              id="notificationsEvenements"
              checked={preferences.notificationsEvenements}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notificationsEvenements: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notificationsElections" className="text-sm font-medium">
              Élections
            </Label>
            <Switch
              id="notificationsElections"
              checked={preferences.notificationsElections}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notificationsElections: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notificationsCotisations" className="text-sm font-medium">
              Cotisations
            </Label>
            <Switch
              id="notificationsCotisations"
              checked={preferences.notificationsCotisations}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notificationsCotisations: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notificationsDocuments" className="text-sm font-medium">
              Documents
            </Label>
            <Switch
              id="notificationsDocuments"
              checked={preferences.notificationsDocuments}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notificationsDocuments: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notificationsBadges" className="text-sm font-medium">
              Badges
            </Label>
            <Switch
              id="notificationsBadges"
              checked={preferences.notificationsBadges}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notificationsBadges: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notificationsIdees" className="text-sm font-medium">
              Idées
            </Label>
            <Switch
              id="notificationsIdees"
              checked={preferences.notificationsIdees}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notificationsIdees: checked })
              }
            />
          </div>
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
                Sauvegarder les préférences
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

