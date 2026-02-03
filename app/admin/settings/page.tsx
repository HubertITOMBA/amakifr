"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  EyeOff,
  Users,
  LogOut,
  RefreshCw,
  HandHeart,
  Plus,
  Pencil,
  MoreHorizontal,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "next-auth/react";
import { getEmailProviderFromDB, updateEmailProvider } from "@/actions/admin/settings";
import type { EmailProvider } from "@/lib/email/providers/types";
import { getAllSessions, revokeSessionAction, revokeAllUserSessionsAction } from "@/actions/sessions";
import type { UserSession } from "@/lib/session-tracker";
import { getElectoralMenuStatus, updateElectoralMenuStatus } from "@/actions/settings/electoral-menu";
import { PermissionsManager } from "@/components/admin/PermissionsManager";
import { upsertPassAssistance, updatePassAssistance } from "@/actions/admin/assistance-settings";
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";

type PassAssistanceRow = {
  id: string;
  description: string;
  montant: number;
  typeCotisationId: string;
  TypeCotisationMensuelle: { id: string; nom: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

/** Normalise une valeur date (string ISO, Date, timestamp, ou objet sérialisé) en Date ou null. */
function parseDateAssistance(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    if (value.trim() === "") return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    if (typeof v.getTime === "function") return parseDateAssistance((v as Date));
    if (v.value != null) return parseDateAssistance(v.value);
    if (v.date != null) return parseDateAssistance(v.date);
  }
  return null;
}

function formatDateAssistance(value: unknown): string {
  const d = parseDateAssistance(value);
  if (!d) return "—";
  try {
    const s = d.toLocaleDateString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    return typeof s === "string" ? s : "—";
  } catch {
    try {
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return "—";
    }
  }
}

const assistanceColumnHelper = createColumnHelper<PassAssistanceRow>();

export default function AdminSettingsPage() {
  const { data: session } = useSession();
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
    electoralMenuEnabled: true,
  });

  // Statistiques système
  const [systemStats, setSystemStats] = useState<any>(null);

  // Sessions actives
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Paramètres Assistance (PassAssistance)
  const [assistanceRows, setAssistanceRows] = useState<PassAssistanceRow[]>([]);
  const [assistanceTypeCotisations, setAssistanceTypeCotisations] = useState<Array<{ id: string; nom: string }>>([]);
  const [loadingAssistance, setLoadingAssistance] = useState(false);
  const [addAssistanceDialogOpen, setAddAssistanceDialogOpen] = useState(false);
  const [addAssistanceForm, setAddAssistanceForm] = useState({
    description: "",
    montant: 50,
    typeCotisationId: "",
  });
  const [submittingAddAssistance, setSubmittingAddAssistance] = useState(false);
  const [viewPassAssistance, setViewPassAssistance] = useState<PassAssistanceRow | null>(null);
  const [editPassAssistance, setEditPassAssistance] = useState<PassAssistanceRow | null>(null);
  const [editPassFormData, setEditPassFormData] = useState({
    description: "",
    montant: 50,
    typeCotisationId: "",
  });
  const [loadingEditPass, setLoadingEditPass] = useState(false);
  const [assistanceSorting, setAssistanceSorting] = useState<SortingState>([]);
  const [assistanceColumnFilters, setAssistanceColumnFilters] = useState<ColumnFiltersState>([]);
  const [assistanceGlobalFilter, setAssistanceGlobalFilter] = useState("");
  const [assistanceSearchTerm, setAssistanceSearchTerm] = useState("");
  const [assistanceColumnVisibility, setAssistanceColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-settings-assistance-column-visibility");
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, boolean>;
          if (Object.keys(parsed).length > 0) {
            return { ...parsed, createdAt: parsed.createdAt ?? true, updatedAt: parsed.updatedAt ?? true };
          }
        }
        const isMobile = window.innerWidth < 768;
        if (isMobile) return { montant: false, createdAt: false, updatedAt: false, description: false };
      } catch {
        // ignorer
      }
    }
    return { description: false };
  });

  useEffect(() => {
    const timer = setTimeout(() => setAssistanceGlobalFilter(assistanceSearchTerm), 300);
    return () => clearTimeout(timer);
  }, [assistanceSearchTerm]);

  useEffect(() => {
    const onResize = () => {
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      const saved = localStorage.getItem("admin-settings-assistance-column-visibility");
      if (isMobile && (!saved || Object.keys(JSON.parse(saved || "{}")).length === 0)) {
        setAssistanceColumnVisibility((prev) => ({
          ...prev,
          montant: false,
          createdAt: false,
          updatedAt: false,
          description: false,
        }));
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    loadSettings();
    loadSystemStats();
    loadEmailProvider();
    loadElectoralMenuStatus();
    if (activeTab === "sessions") {
      loadSessions();
    }
    if (activeTab === "assistance") {
      loadAssistanceSettings();
    }
  }, [activeTab]);

  const loadAssistanceSettings = async () => {
    try {
      setLoadingAssistance(true);
      const resp = await fetch("/api/admin/assistance-settings");
      const res = await resp.json();
      if (!resp.ok || !res.success || !res.data) {
        toast.error(res?.error || "Erreur lors du chargement des paramètres d'assistance");
        return;
      }
      const raw = res.data.passAssistances as Array<{
        id: string;
        description: string;
        montant: number;
        typeCotisationId: string;
        createdAt?: string | null;
        updatedAt?: string | null;
        TypeCotisationMensuelle: { id: string; nom: string } | null;
      }>;
      const rows: PassAssistanceRow[] = raw.map((p) => ({
        id: p.id,
        description: p.description,
        montant: p.montant,
        typeCotisationId: p.typeCotisationId,
        TypeCotisationMensuelle: p.TypeCotisationMensuelle ?? null,
        createdAt: p.createdAt != null && String(p.createdAt).trim() !== "" ? String(p.createdAt) : undefined,
        updatedAt: p.updatedAt != null && String(p.updatedAt).trim() !== "" ? String(p.updatedAt) : undefined,
      }));
      setAssistanceRows(rows);
      setAssistanceTypeCotisations(res.data.typesCotisationAssistance || []);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des paramètres d'assistance");
    } finally {
      setLoadingAssistance(false);
    }
  };

  const availableTypesForNew = assistanceTypeCotisations.filter(
    (t) => !assistanceRows.some((r) => r.typeCotisationId === t.id)
  );

  const handleAddAssistance = async () => {
    if (!addAssistanceForm.typeCotisationId?.trim()) {
      toast.error("Veuillez sélectionner un type de cotisation (Assistance).");
      return;
    }
    setSubmittingAddAssistance(true);
    try {
      const result = await upsertPassAssistance({
        description: addAssistanceForm.description.trim() || "Assistance",
        montant: Number(addAssistanceForm.montant) || 0,
        typeCotisationId: addAssistanceForm.typeCotisationId,
      });
      if (result.success) {
        toast.success(result.message || "Assistance créée");
        setAddAssistanceDialogOpen(false);
        setAddAssistanceForm({ description: "", montant: 50, typeCotisationId: "" });
        await loadAssistanceSettings();
      } else {
        toast.error(result.error || "Erreur lors de la création");
      }
    } finally {
      setSubmittingAddAssistance(false);
    }
  };

  const handleEditPassAssistance = async () => {
    if (!editPassAssistance?.id) return;
    if (!editPassFormData.typeCotisationId?.trim()) {
      toast.error("Veuillez sélectionner un type de cotisation (Assistance).");
      return;
    }
    setLoadingEditPass(true);
    try {
      const result = await updatePassAssistance({
        id: editPassAssistance.id,
        description: editPassFormData.description.trim() || "Assistance",
        montant: Number(editPassFormData.montant) || 0,
        typeCotisationId: editPassFormData.typeCotisationId,
      });
      if (result.success) {
        toast.success(result.message || "Sauvegardé");
        setEditPassAssistance(null);
        await loadAssistanceSettings();
      } else {
        toast.error(result.error || "Erreur");
      }
    } finally {
      setLoadingEditPass(false);
    }
  };

  const assistanceColumns = useMemo(
    () => [
      assistanceColumnHelper.accessor((r) => r.TypeCotisationMensuelle?.nom ?? "", {
        id: "assistance",
        header: "Assistance",
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {row.original.TypeCotisationMensuelle?.nom ?? "—"}
          </span>
        ),
      }),
      assistanceColumnHelper.accessor("montant", {
        header: "Montant",
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {Number(row.original.montant ?? 0).toFixed(2)} €
          </span>
        ),
      }),
      assistanceColumnHelper.accessor((row) => row.createdAt ?? "", {
        id: "createdAt",
        header: "Création",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {formatDateAssistance(getValue())}
          </span>
        ),
      }),
      assistanceColumnHelper.accessor((row) => row.updatedAt ?? "", {
        id: "updatedAt",
        header: "Mis à jour",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {formatDateAssistance(getValue())}
          </span>
        ),
      }),
      assistanceColumnHelper.accessor("description", {
        header: "Description",
        cell: ({ row }) => (
          <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px] block">
            {row.original.description || "—"}
          </span>
        ),
      }),
      assistanceColumnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setViewPassAssistance(item)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Voir
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setEditPassAssistance(item);
                    setEditPassFormData({
                      description: item.description ?? "",
                      montant: Number(item.montant ?? 0),
                      typeCotisationId: item.typeCotisationId ?? "",
                    });
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Éditer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    []
  );

  const assistanceTable = useReactTable({
    data: assistanceRows,
    columns: assistanceColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setAssistanceSorting,
    onColumnFiltersChange: setAssistanceColumnFilters,
    onGlobalFilterChange: setAssistanceGlobalFilter,
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(assistanceColumnVisibility) : updater;
      setAssistanceColumnVisibility(next);
      try {
        localStorage.setItem("admin-settings-assistance-column-visibility", JSON.stringify(next));
      } catch {
        // ignorer
      }
    },
    initialState: {
      pagination: { pageSize: 10 },
    },
    state: {
      sorting: assistanceSorting,
      columnFilters: assistanceColumnFilters,
      globalFilter: assistanceGlobalFilter,
      columnVisibility: assistanceColumnVisibility,
    },
    defaultColumn: { minSize: 50, maxSize: 800 },
  });

  // Tracker la session actuelle au chargement
  useEffect(() => {
    const trackCurrentSession = async () => {
      try {
        await fetch("/api/sessions/track", { method: "POST" });
      } catch (error) {
        // Ignorer silencieusement
      }
    };
    trackCurrentSession();
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

  const loadElectoralMenuStatus = async () => {
    try {
      const result = await getElectoralMenuStatus();
      if (result.success) {
        setDisplaySettings(prev => ({ ...prev, electoralMenuEnabled: result.enabled }));
      }
    } catch (error) {
      console.error("Erreur lors du chargement du statut des menus électoraux:", error);
    }
  };

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const result = await getAllSessions();
      if (result.success && result.sessions) {
        // Marquer la session actuelle
        const currentSessionId = (session?.user as any)?.sessionId;
        const sessionsWithCurrent = result.sessions.map((s) => ({
          ...s,
          isCurrentSession: s.sessionId === currentSessionId,
        }));
        setSessions(sessionsWithCurrent);
      } else {
        toast.error(result.error || "Erreur lors du chargement des sessions");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des sessions:", error);
      toast.error("Erreur lors du chargement des sessions");
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (userId: string, sessionId: string) => {
    try {
      const result = await revokeSessionAction(userId, sessionId);
      if (result.success) {
        toast.success(result.message || "Session déconnectée avec succès");
        await loadSessions();
      } else {
        toast.error(result.error || "Erreur lors de la déconnexion");
      }
    } catch (error) {
      console.error("Erreur lors de la déconnexion de la session:", error);
      toast.error("Erreur lors de la déconnexion de la session");
    }
  };

  const handleRevokeAllSessions = async (userId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir déconnecter toutes les sessions de cet utilisateur ?")) {
      return;
    }

    try {
      const result = await revokeAllUserSessionsAction(userId);
      if (result.success) {
        toast.success(result.message || "Toutes les sessions ont été déconnectées");
        await loadSessions();
      } else {
        toast.error(result.error || "Erreur lors de la déconnexion");
      }
    } catch (error) {
      console.error("Erreur lors de la déconnexion des sessions:", error);
      toast.error("Erreur lors de la déconnexion des sessions");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `Il y a ${days} jour${days > 1 ? "s" : ""}`;
    if (hours > 0) return `Il y a ${hours} heure${hours > 1 ? "s" : ""}`;
    if (minutes > 0) return `Il y a ${minutes} minute${minutes > 1 ? "s" : ""}`;
    return "À l'instant";
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
          // Sauvegarder également le paramètre des menus électoraux dans la base
          const electoralMenuResult = await updateElectoralMenuStatus(displaySettings.electoralMenuEnabled);
          if (!electoralMenuResult.success) {
            toast.error(electoralMenuResult.error || "Erreur lors de la sauvegarde des menus électoraux");
            return;
          }
          // Mettre à jour le cache localStorage pour éviter le flash
          localStorage.setItem("electoral-menu-enabled", displaySettings.electoralMenuEnabled.toString());
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
        <TabsList className="grid w-full grid-cols-8">
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
          <TabsTrigger value="assistance">
            <HandHeart className="h-4 w-4 mr-2" />
            Assistance
          </TabsTrigger>
          <TabsTrigger value="display">
            <Palette className="h-4 w-4 mr-2" />
            Affichage
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Shield className="h-4 w-4 mr-2" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="system">
            <Database className="h-4 w-4 mr-2" />
            Système
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Users className="h-4 w-4 mr-2" />
            Sessions
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
                      <SelectItem key="provider-resend" value="resend">Resend</SelectItem>
                      <SelectItem key="provider-smtp" value="smtp">SMTP (Gmail, Outlook, etc.)</SelectItem>
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

        {/* Onglet Assistance */}
        <TabsContent value="assistance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assistance (PassAssistance)</CardTitle>
              <CardDescription>
                Configurez le montant fixe par type d'assistance et liez-le à un type de cotisation mensuelle (catégorie Assistance).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingAssistance ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Le montant fixe utilisé pour le versement est récupéré depuis la table <code className="text-xs">pass_assistance</code>.
                      Chaque type d'assistance doit être lié à un type de cotisation mensuelle de catégorie <strong>Assistance</strong>.
                    </AlertDescription>
                  </Alert>

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Rechercher..."
                        value={assistanceSearchTerm}
                        onChange={(e) => setAssistanceSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <ColumnVisibilityToggle
                        table={assistanceTable}
                        storageKey="admin-settings-assistance-column-visibility"
                      />
                      <Button
                        onClick={() => {
                          const first = availableTypesForNew[0];
                          if (first) {
                            setAddAssistanceForm((prev) => ({ ...prev, typeCotisationId: first.id }));
                            setAddAssistanceDialogOpen(true);
                          }
                        }}
                        disabled={availableTypesForNew.length === 0}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter une assistance
                      </Button>
                    </div>
                  </div>

                  <div className="mb-4 text-sm text-muted-foreground">
                    {assistanceTable.getFilteredRowModel().rows.length} assistance(s) configurée(s)
                  </div>

                  <DataTable
                    key={`assistance-${assistanceRows.length}-${assistanceRows[0]?.createdAt ?? ""}`}
                    table={assistanceTable}
                    emptyMessage="Aucune assistance configurée. Cliquez sur « Ajouter une assistance » pour en créer une."
                    headerColor="green"
                    headerBold
                    headerUppercase={false}
                    compact={true}
                  />

                  {assistanceTable.getFilteredRowModel().rows.length > 0 && (
                    <div className="hidden md:flex mt-4 flex-col sm:flex-row items-center justify-between gap-3 py-4 border-t">
                      <div className="flex-1 text-sm text-muted-foreground">
                        {assistanceTable.getFilteredRowModel().rows.length} ligne(s) au total
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Lignes par page</span>
                          <Select
                            value={`${assistanceTable.getState().pagination.pageSize}`}
                            onValueChange={(v) => assistanceTable.setPageSize(Number(v))}
                          >
                            <SelectTrigger className="h-8 w-[70px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="top">
                              {[10, 20, 30, 40, 50].map((n) => (
                                <SelectItem key={n} value={`${n}`}>
                                  {n}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <span className="text-sm font-medium">
                          Page {assistanceTable.getState().pagination.pageIndex + 1} sur {assistanceTable.getPageCount()}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => assistanceTable.setPageIndex(0)}
                            disabled={!assistanceTable.getCanPreviousPage()}
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => assistanceTable.previousPage()}
                            disabled={!assistanceTable.getCanPreviousPage()}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => assistanceTable.nextPage()}
                            disabled={!assistanceTable.getCanNextPage()}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => assistanceTable.setPageIndex(assistanceTable.getPageCount() - 1)}
                            disabled={!assistanceTable.getCanNextPage()}
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dialog Voir PassAssistance */}
                  <Dialog open={!!viewPassAssistance} onOpenChange={(open) => !open && setViewPassAssistance(null)}>
                    <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
                      <DialogHeader className="bg-gradient-to-r from-green-500/90 via-emerald-400/80 to-green-500/90 dark:from-green-700/50 dark:via-emerald-600/40 dark:to-green-700/50 text-white px-6 py-4 shadow-md">
                        <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                          <HandHeart className="h-5 w-5" />
                          Détail PassAssistance
                        </DialogTitle>
                      </DialogHeader>
                      {viewPassAssistance && (
                        <div className="space-y-4 px-6 py-5">
                          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20 p-3">
                            <Label className="text-xs font-medium uppercase tracking-wider text-green-700 dark:text-green-400">Assistance</Label>
                            <p className="font-semibold text-gray-900 dark:text-gray-100 mt-1">
                              {viewPassAssistance.TypeCotisationMensuelle?.nom ?? "—"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
                            <Label className="text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">Description</Label>
                            <div className="mt-1 min-h-[100px] max-h-[200px] overflow-y-auto rounded-md bg-white dark:bg-gray-900/50 p-3 border border-gray-100 dark:border-gray-800">
                              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                                {viewPassAssistance.description || "—"}
                              </p>
                            </div>
                          </div>
                          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20 p-3">
                            <Label className="text-xs font-medium uppercase tracking-wider text-green-700 dark:text-green-400">Montant</Label>
                            <p className="font-bold text-lg text-green-800 dark:text-green-200 mt-1">
                              {Number(viewPassAssistance.montant ?? 0).toFixed(2)} €
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-4 sm:gap-6">
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3 flex-1 min-w-[140px]">
                              <Label className="text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">Création</Label>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                                {formatDateAssistance(viewPassAssistance.createdAt)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3 flex-1 min-w-[140px]">
                              <Label className="text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">Mis à jour</Label>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                                {formatDateAssistance(viewPassAssistance.updatedAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                  {/* Dialog Éditer PassAssistance */}
                  <Dialog
                    open={!!editPassAssistance}
                    onOpenChange={(open) => {
                      if (!open) {
                        setEditPassAssistance(null);
                      }
                    }}
                  >
                    <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
                      <DialogHeader className="bg-gradient-to-r from-amber-500/90 via-orange-400/80 to-amber-500/90 dark:from-amber-700/50 dark:via-orange-600/40 dark:to-amber-700/50 text-white px-6 py-4 shadow-md">
                        <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                          <Pencil className="h-5 w-5" />
                          Éditer PassAssistance
                        </DialogTitle>
                        <DialogDescription className="text-amber-100 dark:text-amber-200">
                          Modifiez les champs puis enregistrez.
                        </DialogDescription>
                      </DialogHeader>
                      {editPassAssistance && (
                        <div className="space-y-4 px-6 py-5">
                          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-3">
                            <Label className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">Type de cotisation (Assistance) *</Label>
                            <Select
                              value={editPassFormData.typeCotisationId}
                              onValueChange={(v) => setEditPassFormData((prev) => ({ ...prev, typeCotisationId: v }))}
                            >
                              <SelectTrigger className="mt-1.5 bg-white dark:bg-gray-900">
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                              <SelectContent>
                                {assistanceTypeCotisations.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.nom}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
                            <Label className="text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">Description</Label>
                            <Textarea
                              value={editPassFormData.description}
                              onChange={(e) =>
                                setEditPassFormData((prev) => ({ ...prev, description: e.target.value }))
                              }
                              placeholder="Description (jusqu'à 500 caractères)"
                              maxLength={500}
                              rows={6}
                              className="mt-1.5 min-h-[140px] resize-y bg-white dark:bg-gray-900"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {editPassFormData.description.length} / 500 caractères
                            </p>
                          </div>
                          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-3">
                            <Label className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">Montant (€)</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={editPassFormData.montant}
                              onChange={(e) =>
                                setEditPassFormData((prev) => ({ ...prev, montant: Number(e.target.value) || 0 }))
                              }
                              min={0}
                              step="0.01"
                              className="mt-1.5 max-w-[140px] bg-white dark:bg-gray-900"
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setEditPassAssistance(null)}>
                              Annuler
                            </Button>
                            <Button onClick={handleEditPassAssistance} disabled={loadingEditPass}>
                              {loadingEditPass ? "Enregistrement..." : "Enregistrer"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                  <Dialog open={addAssistanceDialogOpen} onOpenChange={setAddAssistanceDialogOpen}>
                    <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
                      <DialogHeader className="bg-gradient-to-r from-amber-500/90 via-orange-400/80 to-amber-500/90 dark:from-amber-700/50 dark:via-orange-600/40 dark:to-amber-700/50 text-white px-6 py-4 shadow-md">
                        <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                          <Plus className="h-5 w-5" />
                          Ajouter une assistance
                        </DialogTitle>
                        <DialogDescription className="text-amber-100 dark:text-amber-200">
                          Associez un type de cotisation (catégorie Assistance) à un montant fixe et une description.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 px-6 py-5">
                        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-3">
                          <Label className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">Type de cotisation (Assistance) *</Label>
                          <Select
                            value={addAssistanceForm.typeCotisationId}
                            onValueChange={(v) =>
                              setAddAssistanceForm((prev) => ({ ...prev, typeCotisationId: v }))
                            }
                          >
                            <SelectTrigger className="mt-1.5 bg-white dark:bg-gray-900">
                              <SelectValue placeholder="Sélectionner un type" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableTypesForNew.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.nom}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3">
                          <Label className="text-xs font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">Description</Label>
                          <Textarea
                            value={addAssistanceForm.description}
                            onChange={(e) =>
                              setAddAssistanceForm((prev) => ({ ...prev, description: e.target.value }))
                            }
                            placeholder="Ex. Naissance d'un enfant (jusqu'à 500 caractères)"
                            maxLength={500}
                            rows={6}
                            className="mt-1.5 min-h-[140px] resize-y bg-white dark:bg-gray-900"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {addAssistanceForm.description.length} / 500 caractères
                          </p>
                        </div>
                        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 p-3">
                          <Label className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">Montant (€)</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={addAssistanceForm.montant}
                            onChange={(e) =>
                              setAddAssistanceForm((prev) => ({ ...prev, montant: Number(e.target.value) || 0 }))
                            }
                            min={0}
                            step="0.01"
                            className="mt-1.5 max-w-[140px] bg-white dark:bg-gray-900"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={() => setAddAssistanceDialogOpen(false)}>
                            Annuler
                          </Button>
                          <Button onClick={handleAddAssistance} disabled={submittingAddAssistance}>
                            {submittingAddAssistance ? "Création..." : "Créer"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
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
                <h3 className="text-lg font-semibold">Menus électoraux</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="electoralMenuEnabled">Afficher les menus électoraux</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Affiche les menus Élections, Votes, Candidatures et Résultats dans les différentes interfaces
                    </p>
                  </div>
                  <Switch
                    id="electoralMenuEnabled"
                    checked={displaySettings.electoralMenuEnabled}
                    onCheckedChange={(checked) => setDisplaySettings({ ...displaySettings, electoralMenuEnabled: checked })}
                  />
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Lorsque désactivé, les menus électoraux seront masqués dans :
                    <ul className="list-disc list-inside mt-2 ml-4">
                      <li><strong>Navbar publique :</strong> Election et Résultats</li>
                      <li><strong>Menu admin :</strong> Postes, Élections, Votes et Candidatures</li>
                      <li><strong>Menu adhérent :</strong> Mes Candidatures, Mes Votes et Liste des Candidats</li>
                    </ul>
                    <p className="mt-2 text-sm font-semibold">
                      💡 Réactivez ces menus uniquement lors des périodes électorales.
                    </p>
                  </AlertDescription>
                </Alert>
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

        {/* Onglet Permissions */}
        <TabsContent value="permissions" className="space-y-6">
          <PermissionsManager />
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

        {/* Onglet Sessions */}
        <TabsContent value="sessions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sessions actives</CardTitle>
                  <CardDescription>
                    Gérer les sessions des utilisateurs connectés
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSessions}
                  disabled={loadingSessions}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingSessions ? "animate-spin" : ""}`} />
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : sessions.length === 0 ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Aucune session active trouvée. Les sessions sont trackées uniquement si Redis est configuré.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {sessions.length} session(s) active(s)
                  </div>
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <Card key={session.sessionId} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{session.userName}</span>
                                <Badge variant="outline">{session.userEmail}</Badge>
                                {session.isCurrentSession && (
                                  <Badge variant="default">Session actuelle</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                                <div>
                                  <span className="font-medium">IP:</span> {session.ipAddress}
                                </div>
                                <div>
                                  <span className="font-medium">Dernière activité:</span> {getTimeAgo(session.lastActivity)}
                                </div>
                                <div>
                                  <span className="font-medium">Créée le:</span> {formatDate(session.createdAt)}
                                </div>
                                <div>
                                  <span className="font-medium">Appareil:</span>{" "}
                                  <span className="text-xs">{session.userAgent.substring(0, 50)}...</span>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500">
                                Session ID: {session.sessionId.substring(0, 20)}...
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRevokeSession(session.userId, session.sessionId)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <LogOut className="h-4 w-4 mr-2" />
                                Déconnecter
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRevokeAllSessions(session.userId)}
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                              >
                                <LogOut className="h-4 w-4 mr-2" />
                                Tout déconnecter
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

