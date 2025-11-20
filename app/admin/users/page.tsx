"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Search, 
  Edit,
  Eye,
  Shield,
  UserCheck,
  UserX,
  Plus,
  Mail
} from "lucide-react";
import { UserRole, UserStatus } from "@prisma/client";
import { 
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";
import { 
  getAllUsersForAdmin,
  adminUpdateUserRole,
  adminUpdateUserStatus
} from "@/actions/user";
import Link from "next/link";
import { toast } from "sonner";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import { SendEmailModal } from "@/components/admin/SendEmailModal";
import { Checkbox } from "@/components/ui/checkbox";

type UserData = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLogin: string | null;
  adherent: {
    id: string;
    firstname: string;
    lastname: string;
    civility: string | null;
    Telephones: Array<{ numero: string; type: string }>;
    Adresse: Array<{
      streetnum?: string | null;
      street1?: string | null;
      street2?: string | null;
      codepost?: string | null;
      city?: string | null;
      country?: string | null;
    }>;
  } | null;
};

const columnHelper = createColumnHelper<UserData>();

const getRoleColor = (role: UserRole) => {
  switch (role) {
    case UserRole.Admin:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case UserRole.Membre:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case UserRole.Invite:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getRoleLabel = (role: UserRole) => {
  switch (role) {
    case UserRole.Admin:
      return "Admin";
    case UserRole.Membre:
      return "Membre";
    case UserRole.Invite:
      return "Invité";
    default:
      return role;
  }
};

const getStatusColor = (status: UserStatus) => {
  switch (status) {
    case UserStatus.Actif:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case UserStatus.Inactif:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatusLabel = (status: UserStatus) => {
  switch (status) {
    case UserStatus.Actif:
      return "Actif";
    case UserStatus.Inactif:
      return "Inactif";
    default:
      return status;
  }
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  
  // Visibilité des colonnes - charger depuis localStorage
  // Sur mobile, masquer certaines colonnes par défaut pour améliorer la lisibilité
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-users-column-visibility");
        if (saved) {
          return JSON.parse(saved);
        }
        // Par défaut sur mobile, masquer email, date inscription et dernière connexion
        const isMobile = window.innerWidth < 640;
        if (isMobile) {
          return {
            email: false,
            createdAt: false,
            lastLogin: false,
          };
        }
      } catch (error) {
        console.error("Erreur lors du chargement des préférences de colonnes:", error);
      }
    }
    return {};
  });

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAllUsersForAdmin();
      if (res.success && res.users) {
        setUsers(res.users as UserData[]);
      } else {
        toast.error(res.error || "Erreur lors du chargement");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des adhérents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Filtrer les adhérents
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const fullName = user.adherent 
        ? `${user.adherent.civility || ''} ${user.adherent.firstname || ''} ${user.adherent.lastname || ''}`.trim()
        : user.name || '';
      const matchesGlobal = globalFilter === "" || 
        fullName.toLowerCase().includes(globalFilter.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(globalFilter.toLowerCase()));
      
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      
      return matchesGlobal && matchesRole && matchesStatus;
    });
  }, [users, globalFilter, roleFilter, statusFilter]);

  // Actions
  const handleRoleChange = useCallback(async (userId: string, role: UserRole) => {
    const res = await adminUpdateUserRole(userId, role);
    if (res.success) {
      toast.success("Rôle mis à jour");
      await loadAll();
    } else {
      toast.error(res.error || "Erreur lors de la mise à jour du rôle");
    }
  }, [loadAll]);

  const handleStatusChange = useCallback(async (userId: string, status: UserStatus) => {
    const res = await adminUpdateUserStatus(userId, status);
    if (res.success) {
      toast.success("Statut mis à jour. Un email de notification a été envoyé à l'adhérent.");
      await loadAll();
    } else {
      toast.error(res.error || "Erreur lors de la mise à jour du statut");
    }
  }, [loadAll]);

  // Colonnes du tableau
  const columns = useMemo(() => [
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => {
            table.toggleAllPageRowsSelected(!!value);
          }}
          aria-label="Sélectionner tout"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => {
            row.toggleSelected(!!value);
          }}
          aria-label="Sélectionner la ligne"
        />
      ),
      meta: { forceVisible: true },
    }),
    columnHelper.accessor((row) => {
      return row.adherent 
        ? `${row.adherent.civility || ''} ${row.adherent.firstname || ''} ${row.adherent.lastname || ''}`.trim()
        : row.name || "Sans nom";
    }, {
      header: "Adhérent",
      cell: ({ row }) => {
        const user = row.original;
        const fullName = user.adherent 
          ? `${user.adherent.civility || ''} ${user.adherent.firstname || ''} ${user.adherent.lastname || ''}`.trim()
          : user.name || "Sans nom";
        return (
          <div className="font-medium text-gray-900 dark:text-gray-100 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
            {fullName}
          </div>
        );
      },
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: ({ row }) => (
        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate max-w-[150px] sm:max-w-none">
          {row.original.email || "—"}
        </div>
      ),
    }),
    columnHelper.accessor("role", {
      header: "Rôle",
      cell: ({ row }) => {
        const role = row.getValue("role") as UserRole;
        return (
          <Badge className={getRoleColor(role)}>
            {getRoleLabel(role)}
          </Badge>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: "Statut",
      cell: ({ row }) => {
        const status = row.getValue("status") as UserStatus;
        return (
          <Badge className={getStatusColor(status)}>
            {getStatusLabel(status)}
          </Badge>
        );
      },
    }),
    columnHelper.accessor("createdAt", {
      header: "Date inscription",
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return (
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
            {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
          </span>
        );
      },
    }),
    columnHelper.accessor("lastLogin", {
      header: "Dernière connexion",
      cell: ({ row }) => {
        const lastLogin = row.getValue("lastLogin") as string | null;
        if (!lastLogin) return <span className="text-xs sm:text-sm text-gray-400">Jamais</span>;
        const date = new Date(lastLogin);
        return (
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
            {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { forceVisible: true }, // Cette colonne ne peut pas être masquée
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <Link href={`/admin/users/${user.id}/consultation`}>
              <Button size="sm" variant="outline" title="Voir" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </Link>
            <Link href={`/admin/users/${user.id}/edition`}>
              <Button size="sm" variant="outline" title="Éditer" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </Link>
            <Select 
              value={user.role} 
              onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
            >
              <SelectTrigger className="w-24 sm:w-28 h-7 sm:h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.Admin}>Admin</SelectItem>
                <SelectItem value={UserRole.Membre}>Membre</SelectItem>
                <SelectItem value={UserRole.Invite}>Invité</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={user.status} 
              onValueChange={(value) => handleStatusChange(user.id, value as UserStatus)}
            >
              <SelectTrigger className="w-20 sm:w-28 h-7 sm:h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserStatus.Actif}>Actif</SelectItem>
                <SelectItem value={UserStatus.Inactif}>Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      },
    }),
  ], [handleRoleChange, handleStatusChange, filteredUsers]);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: (updater) => {
      const newVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(newVisibility);
      try {
        localStorage.setItem("admin-users-column-visibility", JSON.stringify(newVisibility));
      } catch (error) {
        console.error("Erreur lors de la sauvegarde des préférences:", error);
      }
    },
    state: { sorting, columnFilters, globalFilter, columnVisibility, rowSelection },
  });

  // Synchroniser selectedUserIds avec rowSelection
  useEffect(() => {
    const selectedRows = table.getSelectedRowModel().rows;
    const ids = selectedRows.map(row => row.original.id);
    setSelectedUserIds(ids);
  }, [rowSelection, table]);

  // Statistiques
  const stats = useMemo(() => {
    const total = users.length;
    const actifs = users.filter(u => u.status === UserStatus.Actif).length;
    const admins = users.filter(u => u.role === UserRole.Admin).length;
    const ceMois = users.filter(u => {
      const created = new Date(u.createdAt);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
    return { total, actifs, admins, ceMois };
  }, [users]);

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Gestion des Adhérents
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1 sm:mt-2 text-sm sm:text-base">
            Gérez les membres de l'association
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {selectedUserIds.length > 0 && (
            <Button 
              variant="default" 
              className="w-full sm:w-auto flex items-center justify-center space-x-2"
              onClick={() => setIsEmailModalOpen(true)}
            >
              <Mail className="h-4 w-4" />
              <span>Envoyer un email ({selectedUserIds.length})</span>
            </Button>
          )}
          <Link href="/admin/users/gestion" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto flex items-center justify-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Ajouter un adhérent</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <Card className="!py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 sm:px-6 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
              Total Adhérents
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.total}
            </div>
          </CardContent>
        </Card>

        <Card className="!py-0 border-2 border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 sm:px-6 bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-t-lg">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
              Adhérents Actifs
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.actifs}
            </div>
          </CardContent>
        </Card>

        <Card className="!py-0 border-2 border-purple-200 dark:border-purple-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 sm:px-6 bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20 rounded-t-lg">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
              Administrateurs
            </CardTitle>
            <Shield className="h-4 w-4 text-purple-500 dark:text-purple-400" />
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.admins}
            </div>
          </CardContent>
        </Card>

        <Card className="!py-0 border-2 border-pink-200 dark:border-pink-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 sm:px-6 bg-gradient-to-r from-pink-100 to-pink-50 dark:from-pink-900/30 dark:to-pink-800/20 rounded-t-lg">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
              Nouveaux ce mois
            </CardTitle>
            <Users className="h-4 w-4 text-pink-500 dark:text-pink-400" />
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold text-pink-600 dark:text-pink-400">
              {stats.ceMois}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="!py-0 border-2 border-slate-200 dark:border-slate-800/50 bg-white dark:bg-gray-900">
        <CardHeader className="pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/20 rounded-t-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-gray-700 dark:text-gray-200">
              <Users className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              Liste des Adhérents
            </CardTitle>
            <ColumnVisibilityToggle 
              table={table} 
              storageKey="admin-users-column-visibility"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 pb-4 px-4 sm:px-6">
          {/* Filtres */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher par nom ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                <SelectItem value={UserRole.Admin}>Administrateurs</SelectItem>
                <SelectItem value={UserRole.Membre}>Membres</SelectItem>
                <SelectItem value={UserRole.Invite}>Invités</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value={UserStatus.Actif}>Actifs</SelectItem>
                <SelectItem value={UserStatus.Inactif}>Inactifs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                {filteredUsers.length} adhérent(s) trouvé(s)
              </div>
              <DataTable table={table} emptyMessage="Aucun adhérent trouvé" compact={true} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal d'envoi d'email */}
      <SendEmailModal
        open={isEmailModalOpen}
        onOpenChange={(open) => {
          setIsEmailModalOpen(open);
          if (!open) {
            setSelectedUserIds([]);
            // Désélectionner toutes les lignes du tableau
            table.toggleAllPageRowsSelected(false);
          }
        }}
        selectedUserIds={selectedUserIds}
        selectedUsersCount={selectedUserIds.length}
      />
    </div>
  );
}
