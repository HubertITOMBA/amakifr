"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  Search, 
  Edit,
  Eye,
  Shield,
  UserCheck,
  UserX,
  Plus,
  Mail,
  Award,
  Briefcase,
  Loader2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  KeyRound,
  Trash2
} from "lucide-react";
import { UserRole, UserStatus } from "@prisma/client";
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
  getAllUsersForAdmin,
  adminUpdateUserRole,
  adminUpdateUserStatus,
  adminUpdateAdherentPoste
} from "@/actions/user";
import { adminResetUserPassword } from "@/actions/user/admin-reset-password";
import { DeleteAdherentDialog } from "@/components/admin/DeleteAdherentDialog";
import { getAllPostesTemplates } from "@/actions/postes";
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
  badgesAttribues: Array<{
    id: string;
    Badge: {
      id: string;
      nom: string;
      icone: string;
      couleur: string;
    };
  }>;
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
    PosteTemplate: {
      id: string;
      code: string;
      libelle: string;
      description: string | null;
    } | null;
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
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
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
  const [postes, setPostes] = useState<Array<{ id: string; libelle: string; code: string }>>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  
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
    // Vérifier la session avant de charger les données
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/sign-in");
      return;
    }

    if (sessionStatus === "loading" || !session?.user) {
      return; // Attendre que la session soit chargée
    }

    // Vérifier que l'utilisateur est admin
    if (session.user.role !== "Admin") {
      toast.error("Accès refusé. Vous devez être administrateur.");
      router.push("/");
      return;
    }

    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Créer un nouveau AbortController pour cette requête
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const [usersRes, postesRes] = await Promise.all([
        getAllUsersForAdmin(),
        getAllPostesTemplates(true) // Seulement les postes actifs
      ]);
      
      // Vérifier si la requête a été annulée
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      if (usersRes.success && usersRes.users) {
        setUsers(usersRes.users as UserData[]);
      } else {
        // Ne pas afficher d'erreur si c'est une erreur d'authentification (le middleware gère la redirection)
        if (usersRes.error && !usersRes.error.includes("Non autorisé") && !usersRes.error.includes("Admin requis")) {
          toast.error(usersRes.error || "Erreur lors du chargement");
        } else if (usersRes.error?.includes("Non autorisé")) {
          // Session expirée, le middleware redirigera automatiquement
          return;
        }
      }
      
      if (postesRes.success && postesRes.data) {
        setPostes(postesRes.data.map((p: any) => ({ id: p.id, libelle: p.libelle, code: p.code })));
      }
    } catch (error: any) {
      // Ignorer les erreurs d'annulation
      if (error?.name === "AbortError" || abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      console.error("Erreur:", error);
      
      // Ne pas afficher d'erreur si c'est une erreur de frame (déjà gérée par le middleware)
      if (!error?.message?.includes("Frame with ID") && !error?.message?.includes("removed")) {
        toast.error("Erreur lors du chargement des adhérents");
      }
    } finally {
      // Ne pas mettre à jour le loading si la requête a été annulée
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [sessionStatus, session, router]);

  useEffect(() => {
    loadAll();
    
    // Nettoyer lors du démontage du composant
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadAll]);

  // Afficher un loader pendant le chargement de la session
  if (sessionStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  // Rediriger si non authentifié (le middleware devrait le faire, mais on le fait aussi côté client)
  if (sessionStatus === "unauthenticated") {
    return null; // Le middleware redirigera
  }

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
    // Mise à jour optimiste de l'interface
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === userId ? { ...user, role } : user
      )
    );

    const res = await adminUpdateUserRole(userId, role);
    if (res.success) {
      toast.success("Rôle mis à jour");
      // Optionnel : recharger en arrière-plan pour s'assurer de la cohérence
      // mais sans bloquer l'interface
      loadAll().catch(console.error);
    } else {
      // Annuler la mise à jour optimiste en cas d'erreur
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, role: prevUsers.find(u => u.id === userId)?.role || role } : user
        )
      );
      toast.error(res.error || "Erreur lors de la mise à jour du rôle");
    }
  }, [loadAll]);

  const handleStatusChange = useCallback(async (userId: string, status: UserStatus) => {
    // Vérifier la session avant l'action
    if (sessionStatus !== "authenticated" || !session?.user) {
      toast.error("Session expirée. Veuillez vous reconnecter.");
      router.push("/auth/sign-in");
      return;
    }

    // Mise à jour optimiste de l'interface
    const previousStatus = users.find(u => u.id === userId)?.status;
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === userId ? { ...user, status } : user
      )
    );

    try {
      const res = await adminUpdateUserStatus(userId, status);
      if (res.success) {
        toast.success("Statut mis à jour. Un email de notification a été envoyé à l'adhérent.");
        // Optionnel : recharger en arrière-plan pour s'assurer de la cohérence
        // mais sans bloquer l'interface
        loadAll().catch(console.error);
      } else {
        // Annuler la mise à jour optimiste en cas d'erreur
        if (previousStatus) {
          setUsers(prevUsers => 
            prevUsers.map(user => 
              user.id === userId ? { ...user, status: previousStatus } : user
            )
          );
        }
        // Ne pas afficher d'erreur si c'est une erreur d'authentification
        if (res.error && !res.error.includes("Non autorisé")) {
          toast.error(res.error || "Erreur lors de la mise à jour du statut");
        }
      }
    } catch (error: any) {
      // Annuler la mise à jour optimiste en cas d'erreur
      if (previousStatus) {
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.id === userId ? { ...user, status: previousStatus } : user
          )
        );
      }
      if (!error?.message?.includes("Frame with ID")) {
        toast.error("Erreur lors de la mise à jour du statut");
      }
    }
  }, [loadAll, sessionStatus, session, router, users]);

  const handlePosteChange = useCallback(async (adherentId: string, posteTemplateId: string | null) => {
    // Vérifier la session avant l'action
    if (sessionStatus !== "authenticated" || !session?.user) {
      toast.error("Session expirée. Veuillez vous reconnecter.");
      router.push("/auth/sign-in");
      return;
    }

    try {
      const res = await adminUpdateAdherentPoste(adherentId, posteTemplateId);
      if (res.success) {
        toast.success(res.message || "Poste mis à jour");
        await loadAll();
      } else {
        // Ne pas afficher d'erreur si c'est une erreur d'authentification
        if (res.error && !res.error.includes("Non autorisé")) {
          toast.error(res.error || "Erreur lors de la mise à jour du poste");
        }
      }
    } catch (error: any) {
      if (!error?.message?.includes("Frame with ID")) {
        toast.error("Erreur lors de la mise à jour du poste");
      }
    }
  }, [loadAll, sessionStatus, session, router]);

  const handleSendEmailToUser = useCallback((userId: string) => {
    setSelectedUserIds([userId]);
    setIsEmailModalOpen(true);
  }, []);

  const handleResetPassword = useCallback(async (userId: string, email: string, fullName: string) => {
    // Confirmation de l'action
    const confirmMessage = `Êtes-vous sûr de vouloir réinitialiser le mot de passe de ${fullName} ?\n\nUn nouveau mot de passe temporaire sera généré et envoyé à ${email}.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const result = await adminResetUserPassword(userId);
      
      if (result.success) {
        toast.success(result.message || "Mot de passe réinitialisé avec succès");
      } else {
        toast.error(result.error || "Erreur lors de la réinitialisation du mot de passe");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Une erreur s'est produite lors de la réinitialisation du mot de passe");
    }
  }, []);

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
      return row.adherent?.civility || "—";
    }, {
      id: "civility",
      header: "Civilité",
      cell: ({ row }) => {
        const user = row.original;
        const civility = user.adherent?.civility || "—";
        return (
          <div className="font-medium text-gray-900 dark:text-gray-100 text-xs sm:text-sm">
            {civility}
          </div>
        );
      },
    }),
    columnHelper.accessor((row) => {
      return row.adherent 
        ? `${row.adherent.firstname || ''} ${row.adherent.lastname || ''}`.trim()
        : row.name || "Sans nom";
    }, {
      id: "name",
      header: "Nom complet",
      cell: ({ row }) => {
        const user = row.original;
        const fullName = user.adherent 
          ? `${user.adherent.firstname || ''} ${user.adherent.lastname || ''}`.trim()
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
    columnHelper.display({
      id: "badges",
      header: "Badges",
      cell: ({ row }) => {
        const user = row.original;
        const badges = user.badgesAttribues || [];
        if (badges.length === 0) {
          return <span className="text-xs sm:text-sm text-gray-400">—</span>;
        }
        return (
          <div className="flex items-center gap-1 flex-wrap">
            {badges.slice(0, 3).map((attribution) => {
              const badge = attribution.Badge;
              // Utiliser une icône par défaut si l'icône n'est pas trouvée
              const getBadgeColor = (couleur: string) => {
                const colors: Record<string, string> = {
                  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                  gold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
                };
                return colors[couleur.toLowerCase()] || "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
              };
              return (
                <Badge key={attribution.id} className={`${getBadgeColor(badge.couleur)} text-xs`} title={badge.nom}>
                  <Award className="h-3 w-3 mr-1" />
                  {badge.nom}
                </Badge>
              );
            })}
            {badges.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{badges.length - 3}
              </Badge>
            )}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: "poste",
      header: "Poste",
      cell: ({ row }) => {
        const user = row.original;
        const adherent = user.adherent;
        if (!adherent) {
          return <span className="text-xs sm:text-sm text-gray-400">—</span>;
        }
        const currentPoste = adherent.PosteTemplate;
        return (
          <Select
            value={currentPoste?.id || "none"}
            onValueChange={(value) => {
              handlePosteChange(adherent.id, value === "none" ? null : value);
            }}
          >
            <SelectTrigger className="w-32 sm:w-40 h-7 sm:h-8 text-xs">
              <SelectValue>
                {currentPoste ? (
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    <span>{currentPoste.libelle}</span>
                  </div>
                ) : (
                  "Aucun poste"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Aucun poste</SelectItem>
              {postes.map((poste) => (
                <SelectItem key={poste.id} value={poste.id}>
                  {poste.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    }),
    columnHelper.accessor("createdAt", {
      header: "Date inscription",
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const formatted = `${day}/${month}/${year} ${hours}:${minutes}`;
        return (
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap" title={formatted}>
            {formatted}
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
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const formatted = `${day}/${month}/${year} ${hours}:${minutes}`;
        return (
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap" title={formatted}>
            {formatted}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "actions",
      header: () => <div className="text-center w-full">Actions</div>,
      meta: { forceVisible: true }, // Cette colonne ne peut pas être masquée
      enableResizing: false,
      cell: ({ row }) => {
        const user = row.original;
        const role = user.role;
        const status = user.status;
        
        // Déterminer le prochain statut pour le toggle
        const getNextStatus = (currentStatus: UserStatus): UserStatus => {
          return currentStatus === UserStatus.Actif ? UserStatus.Inactif : UserStatus.Actif;
        };

        return (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Ouvrir le menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/admin/users/${user.id}/consultation`} className="flex items-center gap-2 cursor-pointer">
                    <Eye className="h-4 w-4" />
                    <span>Voir les détails</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/admin/users/${user.id}/edition`} className="flex items-center gap-2 cursor-pointer">
                    <Edit className="h-4 w-4" />
                    <span>Éditer</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Changer le rôle</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem 
                      onClick={() => handleRoleChange(user.id, UserRole.Admin)}
                      className={role === UserRole.Admin ? "bg-red-50 dark:bg-red-900/20" : ""}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 dark:text-red-400 font-bold">A</span>
                        <span>Admin</span>
                        {role === UserRole.Admin && <span className="ml-auto text-xs">✓</span>}
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleRoleChange(user.id, UserRole.Membre)}
                      className={role === UserRole.Membre ? "bg-blue-50 dark:bg-blue-900/20" : ""}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400 font-bold">M</span>
                        <span>Membre</span>
                        {role === UserRole.Membre && <span className="ml-auto text-xs">✓</span>}
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleRoleChange(user.id, UserRole.Invite)}
                      className={role === UserRole.Invite ? "bg-gray-50 dark:bg-gray-900/20" : ""}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 dark:text-gray-400 font-bold">I</span>
                        <span>Invité</span>
                        {role === UserRole.Invite && <span className="ml-auto text-xs">✓</span>}
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem 
                  onClick={() => handleStatusChange(user.id, getNextStatus(status))}
                  className="flex items-center gap-2"
                >
                  {status === UserStatus.Actif ? (
                    <>
                      <UserX className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <span>Désactiver</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span>Activer</span>
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleSendEmailToUser(user.id)}
                  className="flex items-center gap-2"
                >
                  <Mail className="h-4 w-4" />
                  <span>Envoyer un email</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleResetPassword(user.id, user.email || "", user.adherent ? `${user.adherent.firstname} ${user.adherent.lastname}` : user.name || "Utilisateur")}
                  className="flex items-center gap-2 text-orange-600 dark:text-orange-400"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Réinitialiser le mot de passe</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  asChild
                  className="focus:bg-red-50 dark:focus:bg-red-900/20"
                >
                  <div>
                    <DeleteAdherentDialog
                      userId={user.id}
                      userName={user.adherent ? `${user.adherent.firstname} ${user.adherent.lastname}` : user.name || "Utilisateur"}
                      userEmail={user.email}
                    />
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      size: 80,
      minSize: 70,
      maxSize: 100,
    }),
  ], [handleRoleChange, handleStatusChange, handlePosteChange, handleSendEmailToUser, postes, filteredUsers]);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
    initialState: {
      pagination: {
        pageSize: 10,
      },
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
          <Button 
            variant={selectedUserIds.length > 0 ? "default" : "outline"}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
            onClick={() => setIsEmailModalOpen(true)}
          >
            <Mail className="h-4 w-4" />
            <span>
              {selectedUserIds.length > 0 
                ? `Envoyer un email (${selectedUserIds.length})`
                : "Envoyer un email"}
            </span>
          </Button>
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
                className="pl-11"
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
              
              {/* Pagination */}
              <div className="bg-white dark:bg-gray-800 mt-5 flex flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4 sm:gap-0">
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

                  <div className="flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
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
        users={users.map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          status: u.status,
          role: u.role,
          adherent: u.adherent ? {
            firstname: u.adherent.firstname,
            lastname: u.adherent.lastname,
          } : null,
        }))}
      />
    </div>
  );
}
