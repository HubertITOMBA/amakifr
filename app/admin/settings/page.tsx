"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Settings, 
  Mail, 
  Euro, 
  Shield, 
  Palette, 
  Database,
  Info,
  Save,
  CheckCircle2,
  AlertCircle,
  Bell,
  Globe,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEmailProviderFromDB, updateEmailProvider } from "@/actions/admin/settings";
import type { EmailProvider } from "@/lib/email/providers/types";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Paramètres généraux
  const [generalSettings, setGeneralSettings] = useState({
    associationName: "AMAKI France",
    contactEmail: "asso.amaki@gmail.com",
    websiteUrl: typeof window !== "undefined" ? window.location.origin : "",
  });

  // Paramètres d'email
  const [emailSettings, setEmailSettings] = useState({
    provider: (process.env.EMAIL_PROVIDER || 'resend') as EmailProvider,
    fromNoreply: "noreply@amaki.fr",
    fromWebmaster: "webmaster@amaki.fr",
    adminNotificationEmail: "asso.amaki@gmail.com",
    enableNotifications: true,
    enableStatusChangeEmails: true,
    enableCandidacyEmails: true,
    enableEventEmails: true,
  });

  // Paramètres de session
  const [sessionSettings, setSessionSettings] = useState({
    sessionMaxAge: 30, // minutes
    sessionStrategy: "jwt",
  });

  // Paramètres d'affichage
  const [displaySettings, setDisplaySettings] = useState({
    theme: "system",
    showColumnVisibilityToggle: true,
  });

  // Statistiques système
  const [systemStats, setSystemStats] = useState<any>(null);

  useEffect(() => {
    loadSettings();
    loadSystemStats();
    loadEmailProvider();
  }, []);

  const loadEmailProvider = async () => {
    try {
      const provider = await getEmailProviderFromDB();
      if (provider) {
        setEmailSettings(prev => ({ ...prev, provider }));
      }
    } catch (error) {
      console.error("Erreur lors du chargement du provider email:", error);
    }
  };

  const loadSettings = () => {
    // Charger depuis localStorage
    const savedGeneral = localStorage.getItem("admin-settings-general");
    const savedEmail = localStorage.getItem("admin-settings-email");
    const savedDisplay = localStorage.getItem("admin-settings-display");

    if (savedGeneral) {
      try {
        setGeneralSettings({ ...generalSettings, ...JSON.parse(savedGeneral) });
      } catch (e) {
        console.error("Erreur lors du chargement des paramètres généraux:", e);
      }
    }

    if (savedEmail) {
      try {
        setEmailSettings({ ...emailSettings, ...JSON.parse(savedEmail) });
      } catch (e) {
        console.error("Erreur lors du chargement des paramètres email:", e);
      }
    }

    if (savedDisplay) {
      try {
        setDisplaySettings({ ...displaySettings, ...JSON.parse(savedDisplay) });
      } catch (e) {
        console.error("Erreur lors du chargement des paramètres d'affichage:", e);
      }
    }
  };

  const loadSystemStats = async () => {
    try {
      // Ici on pourrait charger des stats depuis le serveur si nécessaire
      setSystemStats({
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toLocaleString("fr-FR"),
      });
    } catch (error) {
      console.error("Erreur lors du chargement des stats:", error);
    }
  };

  const saveSettings = async (category: string) => {
    setSaving(true);
    try {
      switch (category) {
        case "general":
          localStorage.setItem("admin-settings-general", JSON.stringify(generalSettings));
          toast.success("Paramètres sauvegardés avec succès");
          break;
        case "email":
          // Sauvegarder le provider dans la base de données
          const providerResult = await updateEmailProvider({ provider: emailSettings.provider });
          if (providerResult.success) {
            // Sauvegarder les autres paramètres dans localStorage
            const { provider, ...otherSettings } = emailSettings;
            localStorage.setItem("admin-settings-email", JSON.stringify(otherSettings));
            toast.success(providerResult.message || "Paramètres sauvegardés avec succès");
          } else {
            toast.error(providerResult.error || "Erreur lors de la sauvegarde");
            return;
          }
          break;
        case "display":
          localStorage.setItem("admin-settings-display", JSON.stringify(displaySettings));
          toast.success("Paramètres sauvegardés avec succès");
          break;
      }
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde");
      console.error("Erreur:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Settings className="h-8 w-8 text-blue-600" />
            Paramètres
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Configurez les paramètres de l'application
          </p>
        </div>
      </div>

      {/* Alerte d'information */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Les paramètres sont sauvegardés localement dans votre navigateur. Certaines modifications nécessitent une reconfiguration au niveau du serveur.
        </AlertDescription>
      </Alert>

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">
            <Globe className="h-4 w-4 mr-2" />
            Général
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="cotisations">
            <Euro className="h-4 w-4 mr-2" />
            Cotisations
          </TabsTrigger>
          <TabsTrigger value="display">
            <Palette className="h-4 w-4 mr-2" />
            Affichage
          </TabsTrigger>
          <TabsTrigger value="system">
            <Database className="h-4 w-4 mr-2" />
            Système
          </TabsTrigger>
        </TabsList>

        {/* Onglet Général */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
              <CardDescription>
                Configuration des informations de base de l'association
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="associationName">Nom de l'association</Label>
                <Input
                  id="associationName"
                  value={generalSettings.associationName}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, associationName: e.target.value })}
                  placeholder="AMAKI France"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email de contact principal</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={generalSettings.contactEmail}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, contactEmail: e.target.value })}
                  placeholder="asso.amaki@gmail.com"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Email utilisé pour recevoir les notifications administratives
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl">URL du site web</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={generalSettings.websiteUrl}
                  onChange={(e) => setGeneralSettings({ ...generalSettings, websiteUrl: e.target.value })}
                  placeholder="https://amaki.fr"
                />
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={() => saveSettings("general")} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Email */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration des emails</CardTitle>
              <CardDescription>
                Paramètres des adresses email et des notifications automatiques
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Provider Email</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="emailProvider">Provider email par défaut</Label>
                  <Select
                    value={emailSettings.provider}
                    onValueChange={(value) => setEmailSettings({ ...emailSettings, provider: value as EmailProvider })}
                  >
                    <SelectTrigger id="emailProvider" className="w-full">
                      <SelectValue placeholder="Sélectionner un provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resend">Resend</SelectItem>
                      <SelectItem value="smtp">SMTP (Gmail, Outlook, etc.)</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Le provider sélectionné sera utilisé pour tous les envois d'emails de l'application.
                    Les clés API doivent être configurées dans les variables d'environnement.
                  </p>
                  {emailSettings.provider === 'resend' && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Resend nécessite la variable d'environnement <code className="text-xs">RESEND_API_KEY</code>
                      </AlertDescription>
                    </Alert>
                  )}
                  {emailSettings.provider === 'smtp' && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        SMTP nécessite les variables : <code className="text-xs">SMTP_HOST</code>, <code className="text-xs">SMTP_PORT</code>, <code className="text-xs">SMTP_USER</code>, <code className="text-xs">SMTP_PASS</code>, <code className="text-xs">SMTP_FROM</code>
                      </AlertDescription>
                    </Alert>
                  )}
                  {emailSettings.provider === 'sendgrid' && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        SendGrid nécessite les variables : <code className="text-xs">SENDGRID_API_KEY</code>, <code className="text-xs">SENDGRID_FROM</code>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Adresses d'expéditeur</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="fromNoreply">Email "Ne pas répondre" (noreply)</Label>
                  <Input
                    id="fromNoreply"
                    type="email"
                    value={emailSettings.fromNoreply}
                    onChange={(e) => setEmailSettings({ ...emailSettings, fromNoreply: e.target.value })}
                    placeholder="noreply@amaki.fr"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Utilisé pour les emails automatiques (confirmations, notifications)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fromWebmaster">Email webmaster</Label>
                  <Input
                    id="fromWebmaster"
                    type="email"
                    value={emailSettings.fromWebmaster}
                    onChange={(e) => setEmailSettings({ ...emailSettings, fromWebmaster: e.target.value })}
                    placeholder="webmaster@amaki.fr"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Utilisé pour les emails de contact depuis le site
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminNotificationEmail">Email de notification admin</Label>
                  <Input
                    id="adminNotificationEmail"
                    type="email"
                    value={emailSettings.adminNotificationEmail}
                    onChange={(e) => setEmailSettings({ ...emailSettings, adminNotificationEmail: e.target.value })}
                    placeholder="asso.amaki@gmail.com"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Email qui reçoit les notifications administratives
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Notifications automatiques</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableNotifications">Activer les notifications email</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Active ou désactive toutes les notifications email automatiques
                    </p>
                  </div>
                  <Switch
                    id="enableNotifications"
                    checked={emailSettings.enableNotifications}
                    onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, enableNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableStatusChangeEmails">Emails de changement de statut</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Envoyer un email lors du changement de statut d'un compte utilisateur
                    </p>
                  </div>
                  <Switch
                    id="enableStatusChangeEmails"
                    checked={emailSettings.enableStatusChangeEmails}
                    onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, enableStatusChangeEmails: checked })}
                    disabled={!emailSettings.enableNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableCandidacyEmails">Emails de candidature</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Envoyer un email lors du changement de statut d'une candidature
                    </p>
                  </div>
                  <Switch
                    id="enableCandidacyEmails"
                    checked={emailSettings.enableCandidacyEmails}
                    onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, enableCandidacyEmails: checked })}
                    disabled={!emailSettings.enableNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enableEventEmails">Emails d'événements</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Envoyer des emails de confirmation pour les inscriptions aux événements
                    </p>
                  </div>
                  <Switch
                    id="enableEventEmails"
                    checked={emailSettings.enableEventEmails}
                    onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, enableEventEmails: checked })}
                    disabled={!emailSettings.enableNotifications}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={() => saveSettings("email")} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Cotisations */}
        <TabsContent value="cotisations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres des cotisations</CardTitle>
              <CardDescription>
                Informations sur les cotisations (montants par défaut et types)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Ces valeurs sont à titre informatif. Pour modifier les montants et types de cotisations, 
                  utilisez la section "Types de cotisation" dans le menu admin.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Forfait Mensuel</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">15,00 €</div>
                    <Badge className="mt-2" variant="outline">Obligatoire</Badge>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Cotisation Occasionnelle</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">50,00 €</div>
                    <Badge className="mt-2" variant="outline">Obligatoire</Badge>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Formation</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">25,00 €</div>
                    <Badge className="mt-2" variant="secondary">Optionnel</Badge>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Matériel</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">10,00 €</div>
                    <Badge className="mt-2" variant="secondary">Optionnel</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Moyens de paiement acceptés</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Espèces</Badge>
                  <Badge variant="outline">Chèque</Badge>
                  <Badge variant="outline">Virement</Badge>
                  <Badge variant="outline">Carte Bancaire</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Affichage */}
        <TabsContent value="display" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres d'affichage</CardTitle>
              <CardDescription>
                Personnalisez l'apparence et le comportement de l'interface
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="showColumnVisibilityToggle">Afficher le sélecteur de colonnes</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Affiche le bouton de sélection des colonnes dans les tableaux admin
                    </p>
                  </div>
                  <Switch
                    id="showColumnVisibilityToggle"
                    checked={displaySettings.showColumnVisibilityToggle}
                    onCheckedChange={(checked) => setDisplaySettings({ ...displaySettings, showColumnVisibilityToggle: checked })}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Préférences de colonnes</h3>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Vos préférences de colonnes sont sauvegardées automatiquement. 
                    Pour réinitialiser les préférences d'une page, utilisez le bouton "Tout afficher" 
                    dans le menu de sélection des colonnes.
                  </AlertDescription>
                </Alert>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={() => saveSettings("display")} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Système */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations système</CardTitle>
              <CardDescription>
                Statistiques et informations sur l'application et la base de données
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {systemStats && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Version de l'application</div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-white">
                      {systemStats.appVersion}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Environnement</div>
                    <div className="text-xl font-semibold">
                      <Badge variant={systemStats.environment === "production" ? "default" : "secondary"}>
                        {systemStats.environment}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Configuration de session</h3>
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Durée de session</span>
                    <span className="text-sm font-medium">{sessionSettings.sessionMaxAge} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Stratégie</span>
                    <Badge variant="outline">{sessionSettings.sessionStrategy.toUpperCase()}</Badge>
                  </div>
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Les paramètres de session sont configurés au niveau du serveur dans le fichier auth.ts.
                    Les modifications nécessitent un redéploiement de l'application.
                  </AlertDescription>
                </Alert>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Actions système</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm("Êtes-vous sûr de vouloir réinitialiser toutes les préférences de colonnes ?")) {
                        // Supprimer toutes les préférences de colonnes
                        const keys = Object.keys(localStorage).filter(key => key.includes("column-visibility"));
                        keys.forEach(key => localStorage.removeItem(key));
                        toast.success("Préférences de colonnes réinitialisées");
                        window.location.reload();
                      }
                    }}
                  >
                    <EyeOff className="h-4 w-4 mr-2" />
                    Réinitialiser les colonnes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm("Êtes-vous sûr de vouloir effacer tous les paramètres sauvegardés ?")) {
                        localStorage.removeItem("admin-settings-general");
                        localStorage.removeItem("admin-settings-email");
                        localStorage.removeItem("admin-settings-display");
                        toast.success("Paramètres réinitialisés");
                        window.location.reload();
                      }
                    }}
                  >
                    Réinitialiser les paramètres
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

