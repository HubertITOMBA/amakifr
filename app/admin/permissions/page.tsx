"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Shield,
  Search,
  Plus,
  Edit,
  Power,
  PowerOff,
  MoreVertical,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnFiltersState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import {
  getAllPermissionsForAdmin,
  createOrUpdatePermission,
  togglePermissionStatus,
  deletePermission,
} from "@/actions/permissions";
import { toast } from "sonner";
import type { PermissionType } from "@prisma/client";

interface Permission {
  id: string;
  action: string;
  resource: string;
  type: PermissionType;
  roles: string[];
  description: string | null;
  route: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  CreatedBy?: {
    name: string | null;
    email: string | null;
  } | null;
}

const columnHelper = createColumnHelper<Permission>();

const PERMISSION_TYPE_LABELS: Record<string, string> = {
  READ: "Lecture",
  WRITE: "Écriture",
  DELETE: "Suppression",
  MANAGE: "Gestion complète",
};

const PERMISSION_TYPE_DEFAULT = "READ" as const;

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

export default function AdminPermissionsPage() {
  const [data, setData] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Charger les permissions
  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const result = await getAllPermissionsForAdmin();
      if (result.success && result.data) {
        setData(result.data);
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

  // Filtrer les données
  const filteredData = useMemo(() => {
    let filtered = data;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.action.toLowerCase().includes(term) ||
          p.resource.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term) ||
          p.route?.toLowerCase().includes(term)
      );
    }

    if (resourceFilter !== "all") {
      filtered = filtered.filter((p) => p.resource === resourceFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((p) => p.type === typeFilter);
    }

    return filtered;
  }, [data, searchTerm, resourceFilter, typeFilter]);

  // Colonnes du tableau
  const columns = useMemo(
    () => [
      columnHelper.accessor("action", {
        header: "Action",
        cell: (info) => (
          <div className="font-medium">{info.getValue()}</div>
        ),
      }),
      columnHelper.accessor("resource", {
        header: "Ressource",
        cell: (info) => (
          <Badge variant="outline">{info.getValue()}</Badge>
        ),
      }),
      columnHelper.accessor("type", {
        header: "Type",
        cell: (info) => (
          <Badge variant="secondary">
            {PERMISSION_TYPE_LABELS[info.getValue()]}
          </Badge>
        ),
      }),
      columnHelper.accessor("roles", {
        header: "Rôles autorisés",
        cell: (info) => (
          <div className="flex flex-wrap gap-1">
            {info.getValue().map((role) => (
              <Badge key={role} variant="default" className="text-xs">
                {ROLE_LABELS[role] || role}
              </Badge>
            ))}
          </div>
        ),
      }),
      columnHelper.accessor("route", {
        header: "Route",
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {info.getValue() || "-"}
          </span>
        ),
      }),
      columnHelper.accessor("enabled", {
        header: "Statut",
        cell: (info) => (
          <div className="flex items-center gap-2">
            {info.getValue() ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">Activée</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600">Désactivée</span>
              </>
            )}
          </div>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const permission = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingPermission(permission);
                    setIsDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    const { togglePermissionStatus: toggle } = await import("@/actions/permissions");
                    const result = await toggle(
                      permission.action,
                      permission.type,
                      !permission.enabled
                    );
                    if (result.success) {
                      toast.success(result.message);
                      loadPermissions();
                    } else {
                      toast.error(result.error || "Erreur");
                    }
                  }}
                >
                  {permission.enabled ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Désactiver
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Activer
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Récupérer les rôles sélectionnés depuis les checkboxes
    const selectedRoles: string[] = [];
    const checkboxes = e.currentTarget.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][name="roles"]:checked'
    );
    checkboxes.forEach((checkbox) => {
      selectedRoles.push(checkbox.value);
    });
    
    // Récupérer le type depuis le Select
    const typeSelect = e.currentTarget.querySelector<HTMLSelectElement>('select[name="type"]');
    if (typeSelect) {
      formData.set("type", typeSelect.value);
    }
    
    // Ajouter les rôles au FormData
    formData.set("roles", JSON.stringify(selectedRoles));
    
    const result = await createOrUpdatePermission(formData);
    if (result.success) {
      toast.success(result.message);
      setIsDialogOpen(false);
      setEditingPermission(null);
      loadPermissions();
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const resources = useMemo(() => {
    const uniqueResources = Array.from(new Set(data.map((p) => p.resource)));
    return uniqueResources.sort();
  }, [data]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              <CardTitle>Gestion des Permissions</CardTitle>
            </div>
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingPermission(null);
                } else if (editingPermission) {
                  // Initialiser les rôles sélectionnés lors de l'ouverture
                }
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle permission
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingPermission ? "Modifier la permission" : "Nouvelle permission"}
                  </DialogTitle>
                  <DialogDescription>
                    Configurez les permissions pour les actions de l'application.
                    Les modifications sont appliquées immédiatement sans rebuild.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="action">Action (nom de la Server Action)</Label>
                    <Input
                      id="action"
                      name="action"
                      defaultValue={editingPermission?.action || ""}
                      required
                      disabled={!!editingPermission}
                      placeholder="ex: getAllDettesInitiales"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resource">Ressource</Label>
                    <Input
                      id="resource"
                      name="resource"
                      defaultValue={editingPermission?.resource || ""}
                      required
                      placeholder="ex: finances, dettes, paiements"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Type de permission</Label>
                    <Select
                      name="type"
                      defaultValue={editingPermission?.type || PERMISSION_TYPE_DEFAULT}
                      required
                      disabled={!!editingPermission}
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PERMISSION_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="hidden"
                      name="type"
                      value={editingPermission?.type || PERMISSION_TYPE_DEFAULT}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rôles autorisés</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_ROLES.map((role) => {
                        const isSelected =
                          editingPermission?.roles.includes(role) || false;
                        return (
                          <label
                            key={role}
                            className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-muted"
                          >
                            <input
                              type="checkbox"
                              name="roles"
                              value={role}
                              defaultChecked={isSelected}
                              className="rounded"
                            />
                            <span className="text-sm">{ROLE_LABELS[role] || role}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="route">Route (optionnel)</Label>
                    <Input
                      id="route"
                      name="route"
                      defaultValue={editingPermission?.route || ""}
                      placeholder="ex: /admin/finances/dettes"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optionnel)</Label>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={editingPermission?.description || ""}
                      placeholder="Description de la permission"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enabled"
                      name="enabled"
                      defaultChecked={editingPermission?.enabled ?? true}
                      className="rounded"
                    />
                    <Label htmlFor="enabled" className="cursor-pointer">
                      Permission activée
                    </Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        setEditingPermission(null);
                      }}
                    >
                      Annuler
                    </Button>
                    <Button type="submit">
                      {editingPermission ? "Mettre à jour" : "Créer"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par action, ressource, route..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-28"
                  />
                </div>
              </div>
              <Select value={resourceFilter} onValueChange={setResourceFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Ressource" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les ressources</SelectItem>
                  {resources.map((resource) => (
                    <SelectItem key={resource} value={resource}>
                      {resource}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {Object.entries(PERMISSION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tableau */}
            {loading ? (
              <div className="text-center py-8">Chargement...</div>
            ) : (
              <DataTable table={table} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

