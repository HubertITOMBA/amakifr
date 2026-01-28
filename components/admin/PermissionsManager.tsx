"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Save,
  RefreshCw,
  Info,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  SERVER_ACTIONS_CONFIG,
  getActionsByCategory,
  getCategories,
  type ServerActionConfig,
} from "@/lib/server-actions-config";
import {
  getAllPermissionsForAdmin,
  createOrUpdatePermission,
  togglePermissionStatus,
} from "@/actions/permissions";
import type { PermissionType } from "@prisma/client";

const PERMISSION_TYPE_LABELS: Record<string, string> = {
  READ: "Lecture",
  WRITE: "Écriture",
  DELETE: "Suppression",
  MANAGE: "Gestion complète",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  PRESID: "Président",
  VICEPR: "Vice-Président",
  SECRET: "Secrétaire",
  VICESE: "Vice-Secrétaire",
  TRESOR: "Trésorier",
  VTRESO: "Vice-Trésorier",
  COMCPT: "Comptable",
};

const ALL_ROLES = ["ADMIN", "PRESID", "VICEPR", "SECRET", "VICESE", "TRESOR", "VTRESO", "COMCPT"];

interface Permission {
  id: string;
  action: string;
  resource: string;
  type: PermissionType;
  roles: string[];
  description: string | null;
  route: string | null;
  enabled: boolean;
}

export function PermissionsManager() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  // permissions en cours de sauvegarde (par action)
  const [saving, setSaving] = useState<Set<string>>(new Set());
  // brouillons locaux des rôles par action+type (ex: "getAllDettesInitiales_READ")
  const [draftRoles, setDraftRoles] = useState<Map<string, string[]>>(new Map());
  // actions qui ont des modifications non sauvegardées
  const [dirtyActions, setDirtyActions] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const result = await getAllPermissionsForAdmin();
      if (result.success && result.data) {
        setPermissions(result.data);
      } else {
        toast.error(result.error || "Erreur lors du chargement des permissions");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des permissions:", error);
      toast.error("Erreur lors du chargement des permissions");
    } finally {
      setLoading(false);
    }
  };

  // Obtenir toutes les actions par catégorie (pour les onglets)
  const allActionsByCategory = useMemo(() => {
    return getActionsByCategory();
  }, []);

  // Obtenir les catégories disponibles
  const categories = useMemo(() => {
    return getCategories();
  }, []);

  // Initialiser l'onglet actif avec la première catégorie
  useEffect(() => {
    if (categories.length > 0 && !activeTab) {
      setActiveTab(categories[0]);
    }
  }, [categories, activeTab]);

  // Obtenir les actions filtrées par catégorie sélectionnée (pour le contenu)
  const filteredActionsByCategory = useMemo(() => {
    if (selectedCategory === "all") {
      return allActionsByCategory;
    }
    return { [selectedCategory]: allActionsByCategory[selectedCategory] || [] };
  }, [selectedCategory, allActionsByCategory]);

  // Obtenir la permission actuelle pour une action et un type (valeur stockée en base)
  const getCurrentPermission = (
    action: string,
    type: PermissionType
  ): Permission | undefined => {
    return permissions.find(
      (p) => p.action === action && p.type === type && p.enabled
    );
  };

  // Récupérer les rôles à afficher pour une action + type (brouillon si présent, sinon valeur réelle)
  const getRolesFor = (
    actionConfig: ServerActionConfig,
    type: PermissionType,
    permission?: Permission
  ): string[] => {
    const key = `${actionConfig.action}_${type}`;
    const draft = draftRoles.get(key);
    if (draft) return draft;
    return permission?.roles || [];
  };

  // Gérer le changement de rôle pour une permission (sans sauvegarde immédiate)
  const handleRoleToggle = (
    actionConfig: ServerActionConfig,
    type: PermissionType,
    role: string,
    checked: boolean
  ) => {
    const key = `${actionConfig.action}_${type}`;

    const currentPermission = getCurrentPermission(actionConfig.action, type);
    const baseRoles = currentPermission?.roles || [];
    const currentDraft = draftRoles.get(key) || baseRoles;

    let newRoles: string[];
    if (checked) {
      // ajouter le rôle s'il n'est pas déjà présent
      newRoles = Array.from(new Set([...currentDraft, role]));
    } else {
      newRoles = currentDraft.filter((r) => r !== role);
    }

    setDraftRoles((prev) => {
      const next = new Map(prev);
      next.set(key, newRoles);
      return next;
    });

    setDirtyActions((prev) => {
      const next = new Set(prev);
      next.add(actionConfig.action);
      return next;
    });
  };

  // Sauvegarder les modifications pour une action (tous les types concernés)
  const handleSaveAction = async (actionConfig: ServerActionConfig) => {
    const actionName = actionConfig.action;

    if (saving.has(actionName)) return;

    setSaving((prev) => {
      const next = new Set(prev);
      next.add(actionName);
      return next;
    });

    const types: PermissionType[] = ["READ", "WRITE", "DELETE", "MANAGE"];

    try {
      for (const type of types) {
        const key = `${actionConfig.action}_${type}`;
        const draft = draftRoles.get(key);
        const stored = getCurrentPermission(actionConfig.action, type);

        // Ignorer les types sans brouillon ni permission existante
        if (!draft && !stored) continue;

        const rolesToSave = draft ?? stored?.roles ?? [];

        if (rolesToSave.length === 0) {
          // Aucun rôle → désactiver la permission si elle existe
          if (stored) {
            const result = await togglePermissionStatus(actionConfig.action, type, false);
            if (!result.success) {
              toast.error(result.error || "Erreur lors de la désactivation");
              return;
            }
          }
        } else {
          // Créer ou mettre à jour la permission avec les rôles choisis
          const formData = new FormData();
          formData.set("action", actionConfig.action);
          formData.set("resource", actionConfig.resource);
          formData.set("type", type);
          formData.set("roles", JSON.stringify(rolesToSave));
          formData.set("description", actionConfig.description || "");
          formData.set("route", actionConfig.route || "");
          formData.set("enabled", "true");

          const result = await createOrUpdatePermission(formData);
          if (!result.success) {
            toast.error(result.error || "Erreur lors de la sauvegarde");
            return;
          }
        }
      }

      toast.success("Permissions sauvegardées");

      // Recharger depuis la base pour avoir l'état à jour
      await loadPermissions();

      // Nettoyer les brouillons pour cette action
      setDraftRoles((prev) => {
        const next = new Map(prev);
        types.forEach((type) => {
          const key = `${actionConfig.action}_${type}`;
          next.delete(key);
        });
        return next;
      });

      setDirtyActions((prev) => {
        const next = new Set(prev);
        next.delete(actionConfig.action);
        return next;
      });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des permissions:", error);
      toast.error("Erreur lors de la sauvegarde des permissions");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(actionName);
        return next;
      });
    }
  };

  // Annuler les modifications pour une action (revenir à l'état stocké)
  const handleCancelAction = (actionConfig: ServerActionConfig) => {
    const types: PermissionType[] = ["READ", "WRITE", "DELETE", "MANAGE"];

    setDraftRoles((prev) => {
      const next = new Map(prev);
      types.forEach((type) => {
        const key = `${actionConfig.action}_${type}`;
        next.delete(key);
      });
      return next;
    });

    setDirtyActions((prev) => {
      const next = new Set(prev);
      next.delete(actionConfig.action);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Gestion des Permissions
              </CardTitle>
              <CardDescription>
                Configurez les permissions par rôle pour chaque action de l'application.
                Les modifications sont appliquées immédiatement sans rebuild.
              </CardDescription>
            </div>
            <Button onClick={loadPermissions} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Cochez les rôles autorisés pour chaque action, puis cliquez sur <strong>Sauvegarder</strong> pour appliquer les modifications.
              Le rôle <strong>ADMIN</strong> a toujours tous les droits, même s'il n'est pas coché.
            </AlertDescription>
          </Alert>

          {/* Filtre par catégorie */}
          <div className="mb-6">
            <Label htmlFor="category-filter" className="text-foreground font-medium">Filtrer par catégorie</Label>
            <Select value={selectedCategory} onValueChange={(value) => {
              setSelectedCategory(value);
              // Changer l'onglet actif si un filtre spécifique est sélectionné
              if (value !== "all" && categories.includes(value)) {
                setActiveTab(value);
              } else if (value === "all" && categories.length > 0) {
                setActiveTab(categories[0]);
              }
            }}>
              <SelectTrigger id="category-filter" className="w-full sm:w-[300px] mt-2 bg-background border-border text-foreground">
                <SelectValue placeholder="Toutes les catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Liste des actions par catégorie */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
            <div className="w-full overflow-x-auto pb-2 -mx-1 px-1">
              <TabsList className="inline-flex h-auto min-w-full items-center justify-start gap-1.5 bg-muted/50 dark:bg-muted/30 p-1.5 rounded-lg border-2 border-border shadow-sm">
                {categories.map((category) => (
                  <TabsTrigger 
                    key={category} 
                    value={category}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-semibold transition-all whitespace-nowrap px-2.5 py-1.5 text-xs sm:text-sm shrink-0 min-w-fit"
                  >
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {categories.map((category) => {
              // Utiliser les actions filtrées si un filtre est actif, sinon toutes les actions de la catégorie
              const actions = selectedCategory === "all" 
                ? allActionsByCategory[category] || []
                : (selectedCategory === category ? filteredActionsByCategory[category] || [] : []);
              
              // Ne pas afficher le contenu si le filtre est actif et que cette catégorie n'est pas sélectionnée
              if (selectedCategory !== "all" && selectedCategory !== category) {
                return null;
              }

              return (
              <TabsContent key={category} value={category} className="space-y-3">
                {actions.map((actionConfig) => {
                  const readPermission = getCurrentPermission(
                    actionConfig.action,
                    "READ"
                  );
                  const writePermission = getCurrentPermission(
                    actionConfig.action,
                    "WRITE"
                  );
                  const deletePermission = getCurrentPermission(
                    actionConfig.action,
                    "DELETE"
                  );
                  const managePermission = getCurrentPermission(
                    actionConfig.action,
                    "MANAGE"
                  );

                  const hasUnsavedChanges = dirtyActions.has(actionConfig.action);
                  const isActionSaving = saving.has(actionConfig.action);

                  return (
                    <Card key={actionConfig.action} className={`border-l-4 ${hasUnsavedChanges ? 'border-l-orange-500 dark:border-l-orange-400 shadow-md' : 'border-l-blue-500 dark:border-l-blue-400'} bg-card`}>
                      <CardHeader className="pb-2 pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base font-bold text-foreground">{actionConfig.label}</CardTitle>
                            <CardDescription className="mt-0.5 text-xs text-muted-foreground">
                              {actionConfig.description}
                            </CardDescription>
                          </div>
                          {hasUnsavedChanges && (
                            <Badge variant="outline" className="ml-2 border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 text-xs">
                              Modifications non sauvegardées
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-2 pb-4">
                        {/* Permissions READ */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label className="text-sm font-bold text-foreground">
                                {PERMISSION_TYPE_LABELS.READ}
                              </Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground cursor-help">
                                    <Info className="h-3.5 w-3.5" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">
                                    <strong>Activée</strong> : Au moins un rôle a cette permission.<br />
                                    <strong>Désactivée</strong> : Aucun rôle n'a cette permission (sauf ADMIN qui a toujours tous les droits).
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            {getRolesFor(actionConfig, "READ", readPermission).length > 0 ? (
                              <Badge variant="default" className="gap-1 bg-green-600 dark:bg-green-700 text-white px-2 py-0.5 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                Activée
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 text-xs">
                                <XCircle className="h-3 w-3" />
                                Désactivée
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {ALL_ROLES.map((role) => {
                              const roles = getRolesFor(actionConfig, "READ", readPermission);
                              const isChecked = roles.includes(role);
                              return (
                                <label
                                  key={role}
                                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-all hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-600"
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) =>
                                      handleRoleToggle(
                                        actionConfig,
                                        "READ",
                                        role,
                                        checked as boolean
                                      )
                                    }
                                    disabled={isActionSaving || role === "ADMIN"}
                                    className="h-4 w-4 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 border-2 border-gray-400 dark:border-gray-500"
                                  />
                                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                    {ROLE_LABELS[role] || role}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Permissions WRITE */}
                        {actionConfig.defaultType !== "READ" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-bold text-foreground">
                                  {PERMISSION_TYPE_LABELS.WRITE}
                                </Label>
                                <span className="text-xs text-muted-foreground" title="Le badge 'Activée' indique qu'au moins un rôle a cette permission. 'Désactivée' signifie qu'aucun rôle n'a cette permission (sauf ADMIN qui a toujours tous les droits).">
                                  <Info className="h-3.5 w-3.5" />
                                </span>
                              </div>
                              {getRolesFor(actionConfig, "WRITE", writePermission).length > 0 ? (
                                <Badge variant="default" className="gap-1 bg-green-600 dark:bg-green-700 text-white px-2 py-0.5 text-xs">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Activée
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 text-xs">
                                  <XCircle className="h-3 w-3" />
                                  Désactivée
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {ALL_ROLES.map((role) => {
                                const roles = getRolesFor(actionConfig, "WRITE", writePermission);
                                const isChecked = roles.includes(role);
                                return (
                                  <label
                                    key={role}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-all hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-600"
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={(checked) =>
                                        handleRoleToggle(
                                          actionConfig,
                                          "WRITE",
                                          role,
                                          checked as boolean
                                        )
                                      }
                                      disabled={isActionSaving || role === "ADMIN"}
                                      className="h-4 w-4 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 border-2 border-gray-400 dark:border-gray-500"
                                    />
                                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                      {ROLE_LABELS[role] || role}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Permissions DELETE */}
                        {(actionConfig.defaultType === "DELETE" ||
                          actionConfig.defaultType === "MANAGE") && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-bold text-foreground">
                                  {PERMISSION_TYPE_LABELS.DELETE}
                                </Label>
                                <span className="text-xs text-muted-foreground" title="Le badge 'Activée' indique qu'au moins un rôle a cette permission. 'Désactivée' signifie qu'aucun rôle n'a cette permission (sauf ADMIN qui a toujours tous les droits).">
                                  <Info className="h-3.5 w-3.5" />
                                </span>
                              </div>
                              {getRolesFor(actionConfig, "DELETE", deletePermission).length > 0 ? (
                                <Badge variant="default" className="gap-1 bg-green-600 dark:bg-green-700 text-white px-2 py-0.5 text-xs">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Activée
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 text-xs">
                                  <XCircle className="h-3 w-3" />
                                  Désactivée
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {ALL_ROLES.map((role) => {
                                const roles = getRolesFor(actionConfig, "DELETE", deletePermission);
                                const isChecked = roles.includes(role);
                                return (
                                  <label
                                    key={role}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-all hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-600"
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={(checked) =>
                                        handleRoleToggle(
                                          actionConfig,
                                          "DELETE",
                                          role,
                                          checked as boolean
                                        )
                                      }
                                      disabled={isActionSaving || role === "ADMIN"}
                                      className="h-4 w-4 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 border-2 border-gray-400 dark:border-gray-500"
                                    />
                                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                      {ROLE_LABELS[role] || role}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Boutons Sauvegarder/Annuler */}
                        {hasUnsavedChanges && (
                          <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-orange-500/50 dark:border-orange-400/50 bg-orange-50/50 dark:bg-orange-950/30 -mx-6 px-6 py-3">
                            <span className="text-xs text-muted-foreground mr-auto">
                              Modifications non sauvegardées
                            </span>
                            <Button
                              variant="outline"
                              onClick={() => handleCancelAction(actionConfig)}
                              disabled={isActionSaving}
                              className="border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300 text-xs px-3 py-1.5 h-8"
                            >
                              <X className="h-3 w-3 mr-1.5" />
                              Annuler
                            </Button>
                            <Button
                              onClick={() => handleSaveAction(actionConfig)}
                              disabled={isActionSaving}
                              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold shadow-lg px-4 py-1.5 h-8 text-xs"
                            >
                              <Save className="h-3 w-3 mr-1.5" />
                              {isActionSaving ? "Sauvegarde..." : "Sauvegarder"}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
