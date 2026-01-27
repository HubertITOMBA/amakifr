"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  Search, 
  Loader2, 
  ArrowLeft,
  Info,
  MoreHorizontal,
  UserPlus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { AdminRole } from "@prisma/client";
import { 
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import { 
  getAllUsersWithRoles,
  getUserAdminRoles,
  assignAdminRoles,
  removeAdminRole,
} from "@/actions/user/admin-roles";
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/permissions";
import { toast } from "sonner";
import Link from "next/link";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";

interface UserWithRoles {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  adminRoles: AdminRole[];
  adherent?: {
    firstname: string | null;
    lastname: string | null;
    civility: string | null;
  } | null;
}

const columnHelper = createColumnHelper<UserWithRoles>();

export default function AdminRolesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-users-roles-column-visibility");
        if (saved) return JSON.parse(saved);
      } catch (error) {
        console.error("Erreur lors du chargement des préférences:", error);
      }
    }
    return {};
  });
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<AdminRole[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null);

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Charger les utilisateurs avec leurs rôles
  useEffect(() => {
    if (sessionStatus === "loading") return;

    if (!session?.user) {
      router.push("/auth/signin");
      return;
    }

    // Vérifier que l'utilisateur est ADMIN (pas seulement un autre rôle admin)
    const normalizedRole = session.user.role?.toString().trim().toUpperCase();
    if (normalizedRole !== "ADMIN") {
      toast.error("Accès refusé. Seuls les administrateurs peuvent gérer les rôles.");
      router.push("/admin/users");
      return;
    }

    loadUsers();
  }, [session, sessionStatus, router]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAllUsersWithRoles();
      if (result.success && result.users) {
        setUsers(result.users);
      } else {
        toast.error(result.error || "Erreur lors du chargement des utilisateurs");
      }
    } catch (error) {
      console.error("Erreur loadUsers:", error);
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setLoading(false);
    }
  }, []);

  // Filtrer les données
  const filteredData = useMemo(() => {
    return users.filter(item => {
      // Filtre global (recherche)
      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          item.name || "",
          item.email || "",
          item.adherent?.firstname || "",
          item.adherent?.lastname || "",
        ].join(" ").toLowerCase();
        if (!searchText.includes(q)) return false;
      }
      
      return true;
    });
  }, [users, globalFilter]);

  // Colonnes de la table
  const columns = useMemo(() => [
    columnHelper.accessor((row) => {
      if (row.adherent) {
        return `${row.adherent.firstname || ""} ${row.adherent.lastname || ""}`.trim() || row.name || row.email || "—";
      }
      return row.name || row.email || "—";
    }, {
      id: "name",
      header: "Nom",
      cell: ({ row }) => {
        const user = row.original;
        const displayName = user.adherent
          ? `${user.adherent.firstname || ""} ${user.adherent.lastname || ""}`.trim() || user.name || user.email || "—"
          : user.name || user.email || "—";
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {displayName}
            </span>
            {user.email && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {user.email}
              </span>
            )}
          </div>
        );
      },
      size: 250,
      minSize: 200,
      maxSize: 350,
      enableResizing: true,
    }),
    columnHelper.accessor("adminRoles", {
      id: "adminRoles",
      header: "Rôles d'administration",
      cell: ({ row }) => {
        const roles = row.original.adminRoles;
        if (roles.length === 0) {
          return (
            <Badge variant="outline" className="text-gray-500">
              Aucun rôle
            </Badge>
          );
        }
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <Badge
                key={role}
                variant="secondary"
                className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {ROLE_LABELS[role]}
              </Badge>
            ))}
          </div>
        );
      },
      size: 300,
      minSize: 200,
      maxSize: 400,
      enableResizing: true,
    }),
    columnHelper.accessor("role", {
      id: "role",
      header: "Rôle principal",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-sm">
          {row.getValue("role")}
        </Badge>
      ),
      size: 150,
      minSize: 120,
      maxSize: 200,
      enableResizing: true,
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: "Statut",
      cell: ({ row }) => (
        <Badge 
          variant={row.getValue("status") === "Actif" ? "default" : "secondary"}
          className="text-sm"
        >
          {row.getValue("status")}
        </Badge>
      ),
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableResizing: true,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { forceVisible: true },
      enableResizing: false,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50"
              onClick={() => handleOpenAssignDialog(user)}
              title="Gérer les rôles"
            >
              <UserPlus className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <RolesMenu user={user} onRoleRemoved={loadUsers} />
          </div>
        );
      },
      size: 120,
      minSize: 100,
      maxSize: 150,
    }),
  ], [loadUsers]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem("admin-users-roles-column-visibility", JSON.stringify(newVisibility));
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    defaultColumn: {
      minSize: 50,
      maxSize: 800,
    },
  });

  // Ouvrir le dialog d'attribution de rôles
  const handleOpenAssignDialog = async (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoles([...user.adminRoles]);
    
    // Charger les rôles actuels de l'utilisateur
    const result = await getUserAdminRoles(user.id);
    if (result.success && result.roles) {
      setSelectedRoles(result.roles.map(r => r.role));
    }
    
    setIsAssignDialogOpen(true);
  };

  // Toggle un rôle dans la sélection
  const toggleRole = (role: AdminRole) => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  // Attribuer les rôles
  const handleAssignRoles = async () => {
    if (!selectedUser) return;

    try {
      setAssigning(true);
      const formData = new FormData();
      formData.append("userId", selectedUser.id);
      formData.append("roles", JSON.stringify(selectedRoles));

      const result = await assignAdminRoles(formData);
      if (result.success) {
        toast.success(result.message || "Rôles attribués avec succès");
        setIsAssignDialogOpen(false);
        setSelectedUser(null);
        setSelectedRoles([]);
        await loadUsers();
      } else {
        toast.error(result.error || "Erreur lors de l'attribution des rôles");
      }
    } catch (error) {
      console.error("Erreur handleAssignRoles:", error);
      toast.error("Erreur lors de l'attribution des rôles");
    } finally {
      setAssigning(false);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-6">
      <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 !py-0">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin/users">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-blue-600 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5" />
                  Gestion des Rôles d'Administration
                </CardTitle>
                <CardDescription className="text-blue-100 mt-1">
                  Attribuez des rôles d'administration à l'utilisateur (optionnel). Un utilisateur peut avoir plusieurs rôles. Les permissions sont cumulatives. ({filteredData.length} utilisateur(s))
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {/* Recherche et filtres */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par nom, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11"
              />
            </div>
            <ColumnVisibilityToggle 
              table={table} 
              storageKey="admin-users-roles-column-visibility"
            />
          </div>

          {/* Table */}
          {filteredData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Aucun utilisateur Admin/ADMIN trouvé</p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                {filteredData.length} utilisateur(s) trouvé(s)
              </div>
              <DataTable table={table} emptyMessage="Aucun utilisateur trouvé" />
              
              {/* Pagination */}
              <div className="bg-white dark:bg-gray-800 mt-5 flex items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 hidden md:flex">
                <div className="ml-5 mt-2 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                  {table.getFilteredRowModel().rows.length} ligne(s) au total
                </div>

                <div className="flex items-center space-x-6 lg:space-x-8">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lignes par page</p>
                    <Select
                      value={`${table.getState().pagination.pageSize}`}
                      onValueChange={(value) => {
                        table.setPageSize(Number(value));
                      }}
                    >
                      <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={table.getState().pagination.pageSize} />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[10, 20, 30, 40, 50].map((pageSize) => (
                          <SelectItem key={pageSize} value={`${pageSize}`}>
                            {pageSize}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex w-[100px] items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300">
                    Page {table.getState().pagination.pageIndex + 1} sur{" "}
                    {table.getPageCount()}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <span className="sr-only">Aller à la première page</span>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <span className="sr-only">Page précédente</span>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      <span className="sr-only">Page suivante</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="hidden h-8 w-8 p-0 lg:flex"
                      onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                      disabled={!table.getCanNextPage()}
                    >
                      <span className="sr-only">Aller à la dernière page</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'attribution de rôles */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attribuer des rôles d'administration</DialogTitle>
            <DialogDescription>
              Sélectionnez les rôles à attribuer à{" "}
              <strong>
                {selectedUser?.adherent
                  ? `${selectedUser.adherent.firstname || ""} ${selectedUser.adherent.lastname || ""}`.trim() || selectedUser.name || selectedUser.email
                  : selectedUser?.name || selectedUser?.email}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-semibold mb-1">Information importante</p>
                  <p>
                    Un utilisateur peut avoir plusieurs rôles. Les permissions sont cumulatives :
                    si un utilisateur a plusieurs rôles, il bénéficie de toutes les permissions de
                    ces rôles.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {Object.values(AdminRole).map((role) => (
                <div
                  key={role}
                  className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Checkbox
                    id={`role-${role}`}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={`role-${role}`}
                      className="font-semibold text-gray-900 dark:text-white cursor-pointer"
                    >
                      {ROLE_LABELS[role]}
                    </Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignDialogOpen(false);
                setSelectedUser(null);
                setSelectedRoles([]);
              }}
              disabled={assigning}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAssignRoles}
              disabled={assigning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Attribution...
                </>
              ) : (
                "Attribuer les rôles"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Composant menu pour supprimer les rôles
function RolesMenu({ user, onRoleRemoved }: { user: UserWithRoles; onRoleRemoved: () => void }) {
  const [removingRoleId, setRemovingRoleId] = useState<string | null>(null);
  const [userRolesWithIds, setUserRolesWithIds] = useState<Array<{ id: string; role: AdminRole }>>([]);

  const loadUserRoles = useCallback(async () => {
    const result = await getUserAdminRoles(user.id);
    if (result.success && result.roles) {
      setUserRolesWithIds(result.roles.map(r => ({ id: r.id, role: r.role })));
    }
  }, [user.id]);

  useEffect(() => {
    loadUserRoles();
  }, [loadUserRoles]);

  const handleRemoveRole = async (userRoleId: string, roleLabel: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir retirer le rôle "${roleLabel}" à ${user.name || user.email} ?`)) {
      return;
    }

    try {
      setRemovingRoleId(userRoleId);
      const result = await removeAdminRole(userRoleId);
      if (result.success) {
        toast.success(result.message || "Rôle retiré avec succès");
        await loadUserRoles();
        onRoleRemoved();
      } else {
        toast.error(result.error || "Erreur lors du retrait du rôle");
      }
    } catch (error) {
      console.error("Erreur handleRemoveRole:", error);
      toast.error("Erreur lors du retrait du rôle");
    } finally {
      setRemovingRoleId(null);
    }
  };

  if (userRolesWithIds.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 sm:h-8 sm:w-8 p-0 border-blue-300 hover:bg-blue-50"
          title="Supprimer un rôle"
        >
          <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {userRolesWithIds.map(({ id, role }) => (
          <DropdownMenuItem
            key={id}
            onClick={() => handleRemoveRole(id, ROLE_LABELS[role])}
            disabled={removingRoleId === id}
            className="text-red-600 focus:text-red-600"
          >
            {removingRoleId === id ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Retirer {ROLE_LABELS[role]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
