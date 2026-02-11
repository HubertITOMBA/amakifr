"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import * as LucideIcons from "lucide-react";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Shield, 
  Settings, 
  Edit,
  Camera,
  CheckCircle,
  Clock,
  Globe,
  Home,
  Building,
  CreditCard,
  Euro,
  Receipt,
  Vote,
  Users,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Award,
  TrendingUp,
  History,
  Eye,
  Plus,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
  X,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  MessageSquare,
  ThumbsUp,
  Trash2,
  Pencil,
  Info,
  Heart,
  Download,
  Image,
  Table as TableIcon,
  Upload,
  Video,
  File,
  BarChart3,
  Activity,
  Baby,
  Edit2,
  Calendar as CalendarIcon,
  CalendarDays,
  BookOpen,
  Scale,
  Bell,
  Printer,
  FolderKanban
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUserProfile } from "@/hooks/use-user-profile";
import { updateUserData, getUserCandidatures, getUserVotes, getAllCandidatesForProfile, getUserDataForAdminView } from "@/actions/user";
import { downloadPasseportPDF } from "@/actions/passeport";
import { differenceInYears, differenceInMonths } from "date-fns";
import { toast } from "sonner";
import { NotificationPreferences } from "@/components/user/NotificationPreferences";
import { ChangePasswordDialog } from "@/components/user/ChangePasswordDialog";
import { getIdeesByUser, getAllIdees, createIdee, updateIdee, deleteIdee, createCommentaire, toggleApprobation } from "@/actions/idees";
import { getDocuments, deleteDocument } from "@/actions/documents";
import { getRapportsReunionForAdherents, getRapportReunionById } from "@/actions/rapports-reunion";
import { getUserBadges } from "@/actions/badges";
import { StatutIdee, TypeDocument } from "@prisma/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
  createColumnHelper,
} from "@tanstack/react-table";

// Types pour les sections du menu
type MenuSection = 'profile' | 'statistiques' | 'cotisations' | 'candidatures' | 'votes' | 'candidates' | 'idees' | 'documents' | 'badges' | 'enfants' | 'passeport' | 'notifications' | 'settings' | 'rapports' | 'taches' | 'projets';

// Type pour les dettes initiales
interface DetteInitiale {
  id: string;
  annee: number;
  montant: number;
  montantPaye: number;
  montantRestant: number;
  description?: string | null;
}

// Composant Table pour les dettes initiales
function DettesInitialesTable({ dettes }: { dettes: DetteInitiale[] }) {
  const router = useRouter();
  const { userProfile } = useUserProfile();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'annee', desc: true }]);

  const columnHelper = createColumnHelper<DetteInitiale>();

  const columns = useMemo<ColumnDef<DetteInitiale>[]>(
    () => [
      columnHelper.accessor('annee', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-7 px-1 sm:px-2 font-semibold text-[10px] sm:text-xs text-red-900 dark:text-red-300 whitespace-nowrap"
          >
            Année
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-0.5 h-3 w-3 sm:ml-1 sm:h-4 sm:w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-0.5 h-3 w-3 sm:ml-1 sm:h-4 sm:w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 dark:text-red-400 hidden sm:block mr-1" />
            <span className="font-medium text-xs sm:text-sm whitespace-nowrap">{row.getValue('annee')}</span>
          </div>
        ),
        size: 80,
        minSize: 70,
        maxSize: 120,
      }),
      columnHelper.accessor('montant', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-7 px-1 sm:px-2 font-semibold text-[10px] sm:text-xs text-gray-900 dark:text-gray-300 whitespace-nowrap"
          >
            Montant total
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-0.5 h-3 w-3 sm:ml-1 sm:h-4 sm:w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-0.5 h-3 w-3 sm:ml-1 sm:h-4 sm:w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => {
          const dette = row.original;
          const montant = parseFloat(dette.montant.toString());
          const montantRestant = parseFloat(dette.montantRestant.toString());
          
          return (
            <div className="flex flex-col gap-0.5 items-center">
              <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white whitespace-nowrap">
                {montant.toFixed(2).replace('.', ',')} €
              </span>
              {/* Afficher le montant restant en petit sur mobile */}
              <span className="text-[10px] text-gray-500 dark:text-gray-400 md:hidden whitespace-nowrap">
                Rest: <span className={`font-semibold ${
                  montantRestant > 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {montantRestant.toFixed(2).replace('.', ',')} €
                </span>
              </span>
            </div>
          );
        },
        size: 120,
        minSize: 100,
        maxSize: 180,
      }),
      columnHelper.accessor('montantPaye', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-7 px-2 font-semibold text-xs text-green-900 dark:text-green-300"
          >
            Montant payé
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-green-600 dark:text-green-400">
            {parseFloat(row.getValue('montantPaye')).toFixed(2).replace('.', ',')} €
          </span>
        ),
      }),
      columnHelper.accessor('montantRestant', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-7 px-2 font-semibold text-xs text-red-900 dark:text-red-300"
          >
            Montant restant
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => {
          const montant = parseFloat(row.getValue('montantRestant'));
          return (
            <span className={`font-bold ${
              montant > 0 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-green-600 dark:text-green-400'
            }`}>
              {montant.toFixed(2).replace('.', ',')} €
            </span>
          );
        },
      }),
      // Colonne description masquée - ne pas afficher
      // columnHelper.accessor('description', {
      //   header: 'Description',
      //   cell: ({ row }) => (
      //     <span className="text-xs text-gray-600 dark:text-gray-400">
      //       {row.getValue('description') || '-'}
      //     </span>
      //   ),
      // }),
      columnHelper.display({
        id: 'statut',
        header: 'Statut',
        cell: ({ row }) => {
          const montantRestant = parseFloat(row.original.montantRestant.toString());
          return (
            <Badge className={
              montantRestant > 0
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }>
              {montantRestant > 0 ? 'En cours' : 'Payée'}
            </Badge>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const dette = row.original;
          const montantRestant = parseFloat(dette.montantRestant.toString());
          const adherentId = userProfile?.adherent?.id;
          
          const handlePayer = () => {
            if (!adherentId) {
              toast.error("Impossible de récupérer votre identifiant");
              return;
            }
            
            router.push(
              `/paiement?type=dette-initiale&id=${dette.id}&adherentId=${adherentId}&montant=${montantRestant}`
            );
          };

          if (montantRestant <= 0) {
            return (
              <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                Payée
              </span>
            );
          }

          return (
            <Button
              onClick={handlePayer}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white h-7 sm:h-8 text-xs px-2 sm:px-3 whitespace-nowrap"
            >
              <Euro className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Payer</span>
              <span className="sm:hidden">€</span>
            </Button>
          );
        },
        size: 80,
        minSize: 70,
        maxSize: 120,
      }),
    ],
    [router, userProfile]
  );

  const table = useReactTable({
    data: dettes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    defaultColumn: {
      minSize: 50,
      maxSize: 200,
    },
  });

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">
        <Table className="min-w-0 w-full md:min-w-[640px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-red-50 dark:bg-red-900/20">
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id;
                  // Masquer certaines colonnes sur mobile (description est complètement masquée)
                  const isMobileHidden = ['montantPaye', 'montantRestant', 'statut'].includes(columnId);
                  const isAlwaysHidden = ['description'].includes(columnId);
                  
                  const columnSize = header.column.getSize();
                  
                  if (isAlwaysHidden) return null;
                  
                  return (
                    <TableHead 
                      key={header.id} 
                      className={`font-semibold text-center text-[10px] sm:text-xs px-1 sm:px-2 py-1.5 ${isMobileHidden ? 'hidden md:table-cell' : ''}`}
                      style={{ width: `${columnSize}px`, minWidth: `${columnSize}px`, maxWidth: `${columnSize}px` }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => {
                    const columnId = cell.column.id;
                    // Masquer certaines colonnes sur mobile (description est complètement masquée)
                    const isMobileHidden = ['montantPaye', 'montantRestant', 'statut'].includes(columnId);
                    const isAlwaysHidden = ['description'].includes(columnId);
                    
                    if (isAlwaysHidden) return null;
                    
                    const columnSize = cell.column.getSize();
                    
                    return (
                      <TableCell 
                        key={cell.id} 
                        className={`text-center text-xs px-1 sm:px-2 py-1.5 ${isMobileHidden ? 'hidden md:table-cell' : ''}`}
                        style={{ width: `${columnSize}px`, minWidth: `${columnSize}px`, maxWidth: `${columnSize}px` }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-gray-400" />
                    <p className="text-gray-500 text-sm">Aucune dette initiale trouvée.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Composant Table pour l'historique des cotisations par mois
interface HistoriqueCotisation {
  id: string;
  periode: string;
  annee: number;
  mois: number;
  montantAttendu: number;
  montantPaye: number;
  montantRestant: number;
  statut: string;
  description?: string;
  TypeCotisation?: { nom: string };
  Paiements: Array<{
    id: string;
    montant: number;
    datePaiement: Date | string;
    moyenPaiement: string;
    reference?: string;
    description?: string;
    CreatedBy?: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

function HistoriqueCotisationsTable({ cotisations }: { cotisations: HistoriqueCotisation[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'periode', desc: true }]);

  const columnHelper = createColumnHelper<HistoriqueCotisation>();

  const columns = useMemo<ColumnDef<HistoriqueCotisation>[]>(
    () => [
      columnHelper.accessor('periode', {
        header: 'Mois',
        cell: ({ row }) => {
          const { annee, mois } = row.original;
          const date = new Date(annee, mois - 1, 1);
          const nomMois = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
          return (
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              {nomMois.charAt(0).toUpperCase() + nomMois.slice(1)}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'description',
        header: 'Description',
        cell: ({ row }) => {
          const desc = (row.original as any).description;
          const typeNom = (row.original as any).TypeCotisation?.nom;
          const label = desc || typeNom || '—';
          return (
            <span className="text-xs text-gray-700 dark:text-gray-300" title={label}>
              {label}
            </span>
          );
        },
      }),
      columnHelper.accessor('montantAttendu', {
        header: 'Montant Attendu',
        cell: ({ row }) => {
          const montant = row.getValue('montantAttendu') as number;
          return (
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {montant.toFixed(2).replace('.', ',')} €
            </span>
          );
        },
      }),
      columnHelper.accessor('montantRestant', {
        header: 'Restant',
        cell: ({ row }) => {
          const restant = row.getValue('montantRestant') as number;
          return (
            <span className={`text-xs font-medium ${restant > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {restant.toFixed(2).replace('.', ',')} €
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'paiements',
        header: 'Total Payé',
        cell: ({ row }) => {
          const paiements = row.original.Paiements || [];
          const totalPaye = paiements.reduce((sum: number, p: any) => sum + p.montant, 0);
          
          if (totalPaye === 0) {
            return (
              <span className="text-xs text-gray-400 dark:text-gray-500">Aucun paiement</span>
            );
          }
          
          return (
            <div className="text-center">
              <span className="text-xs font-bold text-green-600 dark:text-green-400">
                {totalPaye.toFixed(2).replace('.', ',')} €
              </span>
              {paiements.length > 1 && (
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  ({paiements.length} paiement{paiements.length > 1 ? 's' : ''})
                </div>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('statut', {
        header: 'Statut',
        cell: ({ row }) => {
          const statut = row.getValue('statut') as string;
          const restant = row.original.montantRestant;
          const getStatusBadge = () => {
            if (restant === 0) {
              return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            } else if (restant < row.original.montantAttendu) {
              return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            } else {
              return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            }
          };
          return (
            <Badge className={getStatusBadge()}>
              {restant === 0 ? 'Payée' : restant < row.original.montantAttendu ? 'Partielle' : 'En attente'}
            </Badge>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: cotisations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">
        <Table className="min-w-[640px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-indigo-50 dark:bg-indigo-900/20">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-semibold text-center text-xs px-2 py-1.5">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-center text-xs px-2 py-1.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {/* Ligne des totaux */}
                {(() => {
                  const totalAttendu = cotisations.reduce((s, c) => s + Number(c.montantAttendu), 0);
                  const totalRestant = cotisations.reduce((s, c) => s + Number(c.montantRestant), 0);
                  const totalPaye = cotisations.reduce((s, c) => s + ((c.Paiements || []).reduce((sp: number, p: any) => sp + Number(p.montant), 0)), 0);
                  return (
                    <TableRow className="bg-indigo-100/50 dark:bg-indigo-900/30 border-t-2 border-indigo-200 dark:border-indigo-800 font-semibold">
                      <TableCell colSpan={2} className="text-center text-xs px-2 py-2 text-gray-900 dark:text-gray-100">
                        Total
                      </TableCell>
                      <TableCell className="text-center text-xs px-2 py-2 text-gray-900 dark:text-gray-100">
                        {totalAttendu.toFixed(2).replace('.', ',')} €
                      </TableCell>
                      <TableCell className="text-center text-xs px-2 py-2 text-red-600 dark:text-red-400">
                        {totalRestant.toFixed(2).replace('.', ',')} €
                      </TableCell>
                      <TableCell className="text-center text-xs px-2 py-2 text-green-600 dark:text-green-400">
                        {totalPaye.toFixed(2).replace('.', ',')} €
                      </TableCell>
                      <TableCell className="text-center text-xs px-2 py-2" />
                    </TableRow>
                  );
                })()}
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <History className="h-8 w-8 text-gray-400" />
                    <p className="text-gray-500 text-sm">Aucun historique de cotisation disponible.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Composant Table pour les cotisations du mois
interface CotisationMois {
  id: string;
  type: string;
  montant: number;
  montantPaye: number;
  montantRestant: number;
  dateCotisation: string | Date;
  periode: string;
  statut: string;
  description?: string;
  moyenPaiement: string;
  reference: string;
  isCotisationMensuelle?: boolean;
  isAssistance?: boolean;
  isBeneficiaire?: boolean;
  cotisationMensuelleId?: string;
  assistanceId?: string;
}

function CotisationsMoisTable({
  cotisations,
  vueCotisations = 'mois',
}: {
  cotisations: CotisationMois[];
  vueCotisations?: 'mois' | 'annee' | 'toutes';
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'type', desc: false }]);
  const { userProfile, loading: profileLoading } = useUserProfile();

  const labelTotal =
    vueCotisations === 'annee'
      ? "Total de l'année :"
      : vueCotisations === 'toutes'
        ? 'Total :'
        : 'Total du mois :';

  const columnHelper = createColumnHelper<CotisationMois>();

  // Total à payer = forfait + assistances (hors lignes dont l'adhérent est bénéficiaire)
  const totalMois = useMemo(() => {
    return cotisations.reduce((sum, cot) => sum + (cot.isBeneficiaire ? 0 : cot.montant), 0);
  }, [cotisations]);

  const totalRestantMois = useMemo(() => {
    return cotisations.reduce((sum, cot) => sum + parseFloat(cot.montantRestant.toString()), 0);
  }, [cotisations]);

  const columns = useMemo<ColumnDef<CotisationMois>[]>(
    () => [
      columnHelper.accessor('type', {
        header: 'Type',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.isCotisationMensuelle ? (
              <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            ) : (
              <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            )}
            <span className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white">{row.getValue('type')}</span>
          </div>
        ),
      }),
      columnHelper.accessor('description', {
        header: 'Description',
        cell: ({ row }) => {
          const description = row.getValue('description') as string | undefined;
          return (
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-left">
              {description || '-'}
            </div>
          );
        },
      }),
      columnHelper.accessor('montant', {
        header: 'Montant',
        cell: ({ row }) => (
          <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
            {parseFloat(row.getValue('montant')).toFixed(2).replace('.', ',')} €
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => {
          const montantRestant = parseFloat(row.original.montantRestant.toString());
          const statut = row.original.statut;
          const isBeneficiaire = row.original.isBeneficiaire === true;
          const isPaye = montantRestant === 0 || statut === 'Paye' || statut === 'Valide';
          
          if (isBeneficiaire) {
            return (
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                <Heart className="h-3 w-3 mr-1" />
                Bénéficiaire
              </Badge>
            );
          }
          if (isPaye) {
            return (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Payée
              </Badge>
            );
          }
          
          // Si c'est une cotisation dynamique (non créée par l'admin), afficher un message
          if (row.original.isCotisationMensuelle === false && !row.original.cotisationMensuelleId) {
            return (
              <Badge variant="outline" className="text-xs text-gray-500 dark:text-gray-400">
                <Info className="h-3 w-3 mr-1" />
                En attente de création
              </Badge>
            );
          }
          
          // Déterminer le type de paiement
          // Attendre que le profil soit chargé avant d'afficher le bouton
          if (profileLoading) {
            return (
              <div className="flex items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            );
          }
          
          const adherentId = userProfile?.adherent?.id;
          if (!adherentId) {
            // Si pas d'adhérent, ne pas afficher le bouton
            return null;
          }
          
          // Utiliser montantRestant déjà déclaré plus haut (ligne 559)
          let paymentUrl = '/paiement?';
          paymentUrl += `adherentId=${adherentId}&montant=${montantRestant}`;
          
          if (row.original.isCotisationMensuelle && row.original.cotisationMensuelleId) {
            paymentUrl += `&type=cotisation-mensuelle&id=${row.original.cotisationMensuelleId}`;
          } else if (row.original.isAssistance && row.original.assistanceId) {
            paymentUrl += `&type=assistance&id=${row.original.assistanceId}`;
          } else {
            paymentUrl += `&type=obligation&id=${row.original.id}`;
          }
          
          return (
            <Button
              onClick={() => router.push(paymentUrl)}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white h-7 sm:h-8 text-xs px-2 sm:px-3"
            >
              <Euro className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Payer</span>
              <span className="sm:hidden">€</span>
            </Button>
          );
        },
      }),
    ],
    [router, userProfile, profileLoading]
  );

  const table = useReactTable({
    data: cotisations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <div className="inline-block min-w-full align-middle px-4 sm:px-0">
          <Table className="min-w-full">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-blue-50 dark:bg-blue-900/20">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="font-semibold text-center text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="text-center text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-8 w-8 text-gray-400" />
                      <p className="text-gray-500 text-sm">Aucune cotisation du mois en cours.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* Ligne de total */}
      {cotisations.length > 0 && totalMois > 0 && (
        <div className="flex justify-between items-center gap-3 px-4 sm:px-0 pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">{labelTotal}</span>
            <span className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
              {totalMois.toFixed(2).replace('.', ',')} €
            </span>
            {totalRestantMois > 0 && (
              <span className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                (Reste : {totalRestantMois.toFixed(2).replace('.', ',')} €)
              </span>
            )}
          </div>
          {totalRestantMois > 0 && (
            <Button
              onClick={() => {
                const adherentId = userProfile?.adherent?.id;
                if (!adherentId) {
                  toast.error("Impossible de récupérer votre identifiant");
                  return;
                }
                router.push(
                  `/paiement?type=general&adherentId=${adherentId}&montant=${totalRestantMois}`
                );
              }}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white h-7 sm:h-8 text-xs px-2 sm:px-3"
            >
              <Euro className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Payer le total</span>
              <span className="sm:hidden">Payer</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function UserProfilePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = useCurrentUser();
  const { userProfile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useUserProfile();

  // Vue admin "voir comme l'adhérent"
  const viewAsUserId = searchParams.get("viewAs");
  const isAdminViewAs = Boolean(viewAsUserId && user?.role === "ADMIN");
  const [viewAsProfile, setViewAsProfile] = useState<any>(null);
  const [viewAsLoading, setViewAsLoading] = useState(false);
  useEffect(() => {
    if (!isAdminViewAs || !viewAsUserId) {
      setViewAsProfile(null);
      return;
    }
    let cancelled = false;
    setViewAsLoading(true);
    getUserDataForAdminView(viewAsUserId)
      .then((res) => {
        if (!cancelled && res.success && res.user) setViewAsProfile(res.user);
        else if (!cancelled) setViewAsProfile(null);
      })
      .finally(() => {
        if (!cancelled) setViewAsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdminViewAs, viewAsUserId]);

  const effectiveProfile = isAdminViewAs && viewAsProfile ? viewAsProfile : userProfile;
  const displayUser = isAdminViewAs && viewAsProfile ? viewAsProfile : user;
  const isViewAsMode = isAdminViewAs && viewAsProfile;
  const effectiveLoading = isAdminViewAs ? viewAsLoading : profileLoading;

  // Initialiser activeSection depuis les paramètres d'URL ou par défaut 'profile'
  const sectionFromUrl = searchParams.get('section') as MenuSection | null;
  const [activeSection, setActiveSection] = useState<MenuSection>(
    (sectionFromUrl && ['profile', 'statistiques', 'cotisations', 'candidatures', 'votes', 'candidates', 'idees', 'documents', 'badges', 'enfants', 'passeport', 'notifications', 'settings', 'rapports', 'taches'].includes(sectionFromUrl))
      ? sectionFromUrl
      : 'profile'
  );

  // Mettre à jour activeSection si le paramètre d'URL change
  useEffect(() => {
    if (sectionFromUrl && ['profile', 'statistiques', 'cotisations', 'candidatures', 'votes', 'candidates', 'idees', 'documents', 'badges', 'enfants', 'passeport', 'notifications', 'settings', 'rapports', 'taches'].includes(sectionFromUrl)) {
      setActiveSection(sectionFromUrl);
    }
  }, [sectionFromUrl]);

  const prevActiveSectionRef = useRef<MenuSection | null>(null);
  // Rafraîchir les données cotisations à l'ouverture de la section pour voir les créations récentes (ex. février)
  useEffect(() => {
    if (prevActiveSectionRef.current !== null && activeSection === 'cotisations') {
      refetchProfile();
    }
    prevActiveSectionRef.current = activeSection;
  }, [activeSection, refetchProfile]);

  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [obligationsCotisation, setObligationsCotisation] = useState<any[]>([]);
  const [dettesInitiales, setDettesInitiales] = useState<any[]>([]);
  const [cotisationsMois, setCotisationsMois] = useState<any[]>([]);
  const [avoirs, setAvoirs] = useState<any[]>([]);
  const [historiqueCotisations, setHistoriqueCotisations] = useState<any[]>([]);
  const [historiqueFilterMois, setHistoriqueFilterMois] = useState<string>('all');
  const [historiqueFilterAnnee, setHistoriqueFilterAnnee] = useState<string>('all');
  const [historiqueCalendarOpen, setHistoriqueCalendarOpen] = useState(false);
  // Mois/année et mode d'affichage pour "Cotisations" (un mois / une année / toutes)
  const now = new Date();
  const [selectedCotisationsMois, setSelectedCotisationsMois] = useState<number>(() => now.getMonth() + 1);
  const [selectedCotisationsAnnee, setSelectedCotisationsAnnee] = useState<number>(() => now.getFullYear());
  const [calendarCotisationsOpen, setCalendarCotisationsOpen] = useState(false);
  const [cotisationsVue, setCotisationsVue] = useState<'mois' | 'annee' | 'toutes'>('mois');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedElection, setSelectedElection] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'election'>('date');
  const [groupByElection, setGroupByElection] = useState(true);
  // États pour la section Mes Votes
  const [votesSearchTerm, setVotesSearchTerm] = useState('');
  const [votesSelectedElection, setVotesSelectedElection] = useState<string>('all');
  const [votesSortBy, setVotesSortBy] = useState<'date' | 'name' | 'election' | 'position'>('date');
  const [votesGroupByElection, setVotesGroupByElection] = useState(true);
  // États pour la section Mes Idées
  const [idees, setIdees] = useState<any[]>([]);
  const [allIdees, setAllIdees] = useState<any[]>([]);
  const [ideesLoading, setIdeesLoading] = useState(false);
  const [allIdeesLoading, setAllIdeesLoading] = useState(false);
  const [showCreateIdeeDialog, setShowCreateIdeeDialog] = useState(false);
  const [showEditIdeeDialog, setShowEditIdeeDialog] = useState(false);
  const [editingIdee, setEditingIdee] = useState<any>(null);
  const [ideeFormData, setIdeeFormData] = useState({ titre: '', description: '' });
  const [selectedIdeeTab, setSelectedIdeeTab] = useState<'mes-idees' | 'toutes-idees'>('mes-idees');
  const [showCommentForm, setShowCommentForm] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [expandedIdees, setExpandedIdees] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [rapports, setRapports] = useState<any[]>([]);
  const [rapportsLoading, setRapportsLoading] = useState(false);
  const [selectedRapport, setSelectedRapport] = useState<any>(null);
  const [showRapportDialog, setShowRapportDialog] = useState(false);
  const [badges, setBadges] = useState<any[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [enfants, setEnfants] = useState<any[]>([]);
  const [showEditEnfantDialog, setShowEditEnfantDialog] = useState(false);
  const [editingEnfant, setEditingEnfant] = useState<any>(null);
  const [enfantFormData, setEnfantFormData] = useState({ prenom: '', dateNaissance: '', age: undefined as number | undefined });

  // Cotisations affichées selon le mode : un mois / une année / toutes
  const cotisationsMoisAffichage = useMemo(() => {
    if (activeSection !== 'cotisations' || !effectiveProfile?.adherent || (displayUser as any)?.role === 'ADMIN') {
      return [];
    }
    const adherent = effectiveProfile.adherent as any;
    const cotisationsMensuelles = adherent.CotisationsMensuelles || [];
    const assistances = adherent.Assistances || [];
    const adherentId = adherent.id;
    const typeForfait = (effectiveProfile as any)?.typeForfait;
    const montantForfaitDefaut = typeForfait?.montant ?? 15.00;

    function buildItemsForMonth(annee: number, mois: number): any[] {
      // Une ligne par cotisation_mensuelle (forfait + assistances à payer) — aligné sur l'admin cotisations_du_mois
      const cotisationsDuMois = cotisationsMensuelles.filter((cm: any) =>
        Number(cm.mois) === mois && Number(cm.annee) === annee
      );
      const items: any[] = [];

      cotisationsDuMois.forEach((cm: any) => {
        const montant = Number(cm.montantAttendu);
        const montantPaye = Number(cm.montantPaye);
        const montantRestant = Number(cm.montantRestant);
        const typeNom = cm.TypeCotisation?.nom ?? 'Cotisation';
        const isForfait = !cm.TypeCotisation?.aBeneficiaire;
        const benef = cm.CotisationDuMois?.AdherentBeneficiaire;
        const nomBeneficiaire = benef
          ? [benef.firstname, benef.lastname].filter(Boolean).join(' ').trim()
          : '';
        // Pour les assistances : afficher le bénéficiaire (depuis CotisationDuMois ou depuis la description stockée)
        const descriptionAssistance = nomBeneficiaire
          ? `${typeNom} — bénéficiaire : ${nomBeneficiaire}`
          : (cm.description && typeof cm.description === 'string' && cm.description.includes(' pour ')
              ? cm.description
              : typeNom);
        const description = cm.description || (isForfait ? 'Cotisation mensuelle forfaitaire' : descriptionAssistance);
        items.push({
          id: `cotisation-${cm.id}`,
          type: typeNom,
          montant,
          montantPaye,
          montantRestant: Math.max(0, montantRestant),
          dateCotisation: cm.dateEcheance,
          periode: cm.periode,
          statut: montantRestant <= 0 ? 'Paye' : cm.statut,
          description,
          moyenPaiement: 'Non payé',
          reference: cm.id,
          isCotisationMensuelle: true,
          cotisationMensuelleId: cm.id
        });
      });

      if (cotisationsDuMois.length === 0) {
        const periode = `${annee}-${String(mois).padStart(2, '0')}`;
        items.push({
          id: `forfait-dynamique-${mois}-${annee}`,
          type: 'Forfait mensuel',
          montant: montantForfaitDefaut,
          montantPaye: 0,
          montantRestant: montantForfaitDefaut,
          dateCotisation: new Date(annee, mois - 1, 15),
          periode,
          statut: 'EnAttente',
          description: 'Cotisation mensuelle forfaitaire (non créée par l\'admin)',
          moyenPaiement: 'Non payé',
          reference: 'dynamique',
          isCotisationMensuelle: false,
          cotisationMensuelleId: null
        });
      }

      return items;
    }

    if (cotisationsVue === 'mois') {
      return buildItemsForMonth(selectedCotisationsAnnee, selectedCotisationsMois);
    }

    if (cotisationsVue === 'annee') {
      const periodesAnnee = new Set<number>();
      cotisationsMensuelles
        .filter((cm: any) => Number(cm.annee) === selectedCotisationsAnnee)
        .forEach((cm: any) => periodesAnnee.add(Number(cm.mois)));
      assistances.forEach((ass: any) => {
        const d = new Date(ass.dateEvenement);
        if (d.getFullYear() === selectedCotisationsAnnee) periodesAnnee.add(d.getMonth() + 1);
      });
      const moisToShow = periodesAnnee.size > 0 ? Array.from(periodesAnnee).sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const all: any[] = [];
      moisToShow.forEach((m) => all.push(...buildItemsForMonth(selectedCotisationsAnnee, m)));
      return all;
    }

    // cotisationsVue === 'toutes' : toutes les périodes ayant des données
    const periodesSet = new Set<string>();
    cotisationsMensuelles.forEach((cm: any) => periodesSet.add(`${cm.annee}-${String(cm.mois).padStart(2, '0')}`));
    assistances.forEach((ass: any) => {
      const d = new Date(ass.dateEvenement);
      periodesSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    const periodes = Array.from(periodesSet)
      .map((p) => {
        const [y, m] = p.split('-');
        return { annee: parseInt(y, 10), mois: parseInt(m, 10) };
      })
      .sort((a, b) => b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois);

    const all: any[] = [];
    periodes.forEach(({ annee, mois }) => {
      all.push(...buildItemsForMonth(annee, mois));
    });
    return all;
  }, [activeSection, effectiveProfile, (displayUser as any)?.role, selectedCotisationsMois, selectedCotisationsAnnee, cotisationsVue]);

  // Filtre et totaux pour l'historique des cotisations par mois
  const filteredHistoriqueCotisations = useMemo(() => {
    return historiqueCotisations.filter((c: any) => {
      const matchMois = historiqueFilterMois === 'all' || Number(c.mois) === Number(historiqueFilterMois);
      const matchAnnee = historiqueFilterAnnee === 'all' || Number(c.annee) === Number(historiqueFilterAnnee);
      return matchMois && matchAnnee;
    });
  }, [historiqueCotisations, historiqueFilterMois, historiqueFilterAnnee]);

  const historiqueAnneesOptions = useMemo(() => {
    const years = new Set(historiqueCotisations.map((c: any) => Number(c.annee)));
    return Array.from(years).sort((a, b) => b - a);
  }, [historiqueCotisations]);

  // Charger les données selon la section active
  useEffect(() => {
    const loadSectionData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        switch (activeSection) {
          case 'cotisations':
            // Charger les cotisations, obligations, dettes initiales et cotisations du mois depuis le profil utilisateur
            // SAUF si l'utilisateur affiché est admin (l'admin ne cotise ni ne bénéficie d'assistances)
            const isAdmin = (displayUser as any)?.role === 'ADMIN';
            
            if (effectiveProfile?.adherent && !isAdmin) {
              setCotisations((effectiveProfile.adherent as any).Cotisations || []);
              setObligationsCotisation((effectiveProfile.adherent as any).ObligationsCotisation || []);
              setDettesInitiales((effectiveProfile.adherent as any).DettesInitiales || []);
              setAvoirs((effectiveProfile.adherent as any).Avoirs || []);
              
              // Construire la liste des cotisations du mois : forfait mensuel + assistances du mois (séparés)
              const cotisationsMensuelles = ((effectiveProfile.adherent as any).CotisationsMensuelles || []);
              const assistances = ((effectiveProfile.adherent as any).Assistances || []);
              
              // Filtrer les cotisations mensuelles du mois en cours
              const moisCourant = new Date().getMonth() + 1;
              const anneeCourante = new Date().getFullYear();
              const cotisationMensuelleCourante = cotisationsMensuelles.find((cm: any) => 
                Number(cm.mois) === moisCourant && Number(cm.annee) === anneeCourante
              );
              
              const items: any[] = [];
              
              // Si une cotisation mensuelle existe pour le mois en cours, utiliser ses données
              if (cotisationMensuelleCourante) {
                // Récupérer le montant du forfait depuis le TypeCotisation ou utiliser 15€ par défaut
                const montantForfait = cotisationMensuelleCourante.TypeCotisation?.montant 
                  ? Number(cotisationMensuelleCourante.TypeCotisation.montant)
                  : 15.00;
                
                // Calculer le montant payé et restant pour le forfait uniquement
                // On doit estimer la part du forfait dans les paiements totaux
                const montantTotalCotisation = Number(cotisationMensuelleCourante.montantAttendu);
                const montantPayeTotal = Number(cotisationMensuelleCourante.montantPaye);
                const montantRestantTotal = Number(cotisationMensuelleCourante.montantRestant);
                
                // Calculer la proportion du forfait dans le total
                const proportionForfait = montantTotalCotisation > 0 ? montantForfait / montantTotalCotisation : 1;
                const montantPayeForfait = montantPayeTotal * proportionForfait;
                const montantRestantForfait = montantForfait - montantPayeForfait;
                
                items.push({
                  id: `forfait-${cotisationMensuelleCourante.id}`,
                  type: 'Forfait mensuel',
                  montant: montantForfait,
                  montantPaye: montantPayeForfait,
                  montantRestant: Math.max(0, montantRestantForfait),
                  dateCotisation: cotisationMensuelleCourante.dateEcheance,
                  periode: cotisationMensuelleCourante.periode,
                  statut: montantRestantForfait <= 0 ? 'Paye' : cotisationMensuelleCourante.statut,
                  description: 'Cotisation mensuelle forfaitaire',
                  moyenPaiement: 'Non payé',
                  reference: cotisationMensuelleCourante.id,
                  isCotisationMensuelle: true,
                  cotisationMensuelleId: cotisationMensuelleCourante.id
                });
              } else {
                // Si aucune cotisation mensuelle n'existe pour le mois en cours, calculer dynamiquement
                // (comme pour la cotisation prévisionnelle du mois prochain)
                // Utiliser le typeForfait récupéré depuis getUserData
                const typeForfait = (effectiveProfile as any)?.typeForfait;
                const montantForfait = typeForfait?.montant || 15.00; // 15€ par défaut si pas de type
                const periode = `${anneeCourante}-${String(moisCourant).padStart(2, '0')}`;
                
                items.push({
                  id: `forfait-dynamique-${moisCourant}-${anneeCourante}`,
                  type: 'Forfait mensuel',
                  montant: montantForfait,
                  montantPaye: 0,
                  montantRestant: montantForfait,
                  dateCotisation: new Date(anneeCourante, moisCourant - 1, 15),
                  periode: periode,
                  statut: 'EnAttente',
                  description: 'Cotisation mensuelle forfaitaire (non créée par l\'admin)',
                  moyenPaiement: 'Non payé',
                  reference: 'dynamique',
                  isCotisationMensuelle: false, // Pas de cotisation mensuelle réelle
                  cotisationMensuelleId: null
                });
              }
              
              // Créer une ligne pour chaque assistance du mois en cours
              // IMPORTANT: On affiche seulement les assistances que l'adhérent doit payer (pas celles dont il est bénéficiaire)
              const adherentId = (effectiveProfile.adherent as any)?.id;
              const assistanceItems = assistances
                .filter((ass: any) => {
                  // Filtrer par mois en cours
                  const dateAss = new Date(ass.dateEvenement);
                  const isMoisCourant = dateAss.getMonth() + 1 === moisCourant && dateAss.getFullYear() === anneeCourante;
                  
                  // Exclure les assistances dont l'utilisateur est bénéficiaire (il ne les paie pas)
                  const isBeneficiaire = ass.adherentId === adherentId;
                  
                  return isMoisCourant && !isBeneficiaire;
                })
                .map((ass: any) => ({
                  id: `assistance-${ass.id}`,
                  type: `Assistance ${ass.type}`,
                  montant: Number(ass.montant),
                  montantPaye: Number(ass.montantPaye || 0),
                  montantRestant: Number(ass.montantRestant || ass.montant),
                  dateCotisation: ass.dateEvenement,
                  periode: `${new Date(ass.dateEvenement).getFullYear()}-${String(new Date(ass.dateEvenement).getMonth() + 1).padStart(2, '0')}`,
                  statut: ass.statut === 'Paye' || (ass.montantRestant !== undefined && Number(ass.montantRestant) <= 0) ? 'Valide' : 'EnAttente',
                  description: `Assistance pour ${ass.type}${ass.Adherent ? ` (${ass.Adherent.firstname} ${ass.Adherent.lastname})` : ''}`,
                  moyenPaiement: 'Non payé',
                  reference: ass.id,
                  isAssistance: true,
                  assistanceId: ass.id
                }));
              
              setCotisationsMois([...items, ...assistanceItems]);
              
              // Construire l'historique des cotisations mensuelles avec leurs paiements
              const toutesCotisationsMensuelles = ((effectiveProfile.adherent as any).CotisationsMensuelles || []);
              setHistoriqueCotisations(toutesCotisationsMensuelles);
            } else if (isAdmin) {
              // Si l'utilisateur est admin, ne pas afficher de cotisations
              setCotisations([]);
              setObligationsCotisation([]);
              setDettesInitiales([]);
              setAvoirs([]);
              setCotisationsMois([]);
              setHistoriqueCotisations([]);
            }
            break;
          case 'candidatures':
            const candidaturesResult = await getUserCandidatures();
            if (candidaturesResult.success) {
              setCandidatures(candidaturesResult.candidatures || []);
            }
            break;
          case 'votes':
            const votesResult = await getUserVotes();
            if (votesResult.success) {
              setVotes(votesResult.votes || []);
            }
            break;
          case 'candidates':
            const candidatesResult = await getAllCandidatesForProfile();
            if (candidatesResult.success) {
              setCandidates(candidatesResult.candidates || []);
            }
            break;
          case 'documents':
            setDocumentsLoading(true);
            const documentsResult = await getDocuments();
            if (documentsResult.success && documentsResult.documents) {
              setDocuments(documentsResult.documents || []);
            } else {
              setDocuments([]);
            }
            setDocumentsLoading(false);
            break;
          case 'rapports':
            setRapportsLoading(true);
            const rapportsResult = await getRapportsReunionForAdherents();
            if (rapportsResult.success && rapportsResult.rapports) {
              setRapports(rapportsResult.rapports || []);
            } else {
              setRapports([]);
            }
            setRapportsLoading(false);
            break;
          case 'badges':
            setBadgesLoading(true);
            if (user.id) {
              const badgesResult = await getUserBadges(user.id);
              if (badgesResult.success && badgesResult.data) {
                setBadges(badgesResult.data || []);
              } else {
                setBadges([]);
              }
            }
            setBadgesLoading(false);
            break;
          case 'enfants':
            if (effectiveProfile?.adherent) {
              setEnfants((effectiveProfile.adherent as any).Enfants || []);
            } else {
              setEnfants([]);
            }
            break;
          case 'statistiques':
            // Les statistiques sont calculées à partir des données existantes
            break;
          case 'idees':
            setIdeesLoading(true);
            const ideesResult = await getIdeesByUser(user.id);
            if (ideesResult.success && ideesResult.data) {
              setIdees(ideesResult.data || []);
            } else {
              toast.error(ideesResult.error || "Erreur lors du chargement des idées");
            }
            setIdeesLoading(false);
            // Charger aussi toutes les idées validées
            setAllIdeesLoading(true);
            const allIdeesResult = await getAllIdees();
            if (allIdeesResult.success && allIdeesResult.data) {
              setAllIdees(allIdeesResult.data || []);
            }
            setAllIdeesLoading(false);
            break;
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        setLoading(false);
      }
    };

    loadSectionData();
  }, [activeSection, user, effectiveProfile]);

  const handleDownloadPasseport = async () => {
    try {
      toast.loading("Génération du passeport en cours...");
      const result = await downloadPasseportPDF();
      
      if (result.success && result.pdfBuffer && result.numeroPasseport) {
        // Le pdfBuffer est un Array (sérialisé depuis le serveur), on doit le convertir en Uint8Array pour le Blob
        const uint8Array = new Uint8Array(result.pdfBuffer);
        const blob = new Blob([uint8Array], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Passeport-AMAKI-${result.numeroPasseport}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success(`Passeport téléchargé avec succès ! (${result.numeroPasseport})`);
      } else {
        toast.error(result.error || "Erreur lors du téléchargement du passeport");
      }
    } catch (error) {
      console.error("Erreur lors du téléchargement du passeport:", error);
      toast.error("Erreur lors du téléchargement du passeport");
    }
  };


  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <DynamicNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-300">Veuillez vous connecter pour voir votre profil</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Actif':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Inactif':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'MEMBRE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'INVITE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCandidacyStatusColor = (status: string) => {
    switch (status) {
      case 'Validee':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'EnAttente':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Rejetee':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getElectionStatusColor = (status: string) => {
    switch (status) {
      case 'Ouverte':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Cloturee':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'EnPreparation':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCotisationStatusColor = (status: string) => {
    switch (status) {
      case 'Valide':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'EnAttente':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Annule':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getObligationStatusColor = (status: string) => {
    switch (status) {
      case 'Paye':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'PartiellementPaye':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'EnAttente':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'EnRetard':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTypeCotisationLabel = (type: string) => {
    switch (type) {
      case 'Forfait':
        return 'Forfait';
      case 'Assistance':
        return 'Assistance';
      case 'Anniversaire':
        return 'Anniversaire';
      case 'Adhesion':
        return 'Adhésion';
      default:
        return type;
    }
  };

  const getMoyenPaiementLabel = (moyen: string) => {
    switch (moyen) {
      case 'Especes':
        return 'Espèces';
      case 'Cheque':
        return 'Chèque';
      case 'Virement':
        return 'Virement';
      case 'CarteBancaire':
        return 'Carte bancaire';
      default:
        return moyen;
    }
  };

  // Fonctions de filtrage et tri pour les candidats
  const getFilteredAndSortedCandidates = () => {
    let filtered = candidates;

    // Filtrage par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(candidate => 
        candidate.adherent.firstname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.adherent.lastname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.position.titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.election.titre?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrage par élection
    if (selectedElection !== 'all') {
      filtered = filtered.filter(candidate => candidate.election.id === selectedElection);
    }

    // Filtrage par statut
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(candidate => candidate.status === selectedStatus);
    }

    // Tri
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          const nameA = `${a.adherent.firstname} ${a.adherent.lastname}`.toLowerCase();
          const nameB = `${b.adherent.firstname} ${b.adherent.lastname}`.toLowerCase();
          return nameA.localeCompare(nameB);
        case 'election':
          return a.election.titre.localeCompare(b.election.titre);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  };

  // Grouper les candidats par élection
  const getGroupedCandidates = () => {
    const filtered = getFilteredAndSortedCandidates();
    
    if (!groupByElection) {
      return { 'Tous les candidats': filtered };
    }

    const grouped = filtered.reduce((acc, candidate) => {
      const electionTitle = candidate.election.titre;
      if (!acc[electionTitle]) {
        acc[electionTitle] = [];
      }
      acc[electionTitle].push(candidate);
      return acc;
    }, {} as Record<string, any[]>);

    return grouped;
  };

  // Obtenir la liste unique des élections pour le filtre
  const getUniqueElections = () => {
    const elections = candidates.map(candidate => candidate.election);
    const unique = elections.filter((election, index, self) => 
      index === self.findIndex(e => e.id === election.id)
    );
    return unique;
  };

  // Fonctions dédiées aux votes: filtres/tri/regroupement
  const getUniqueElectionsFromVotes = () => {
    const elections = votes.map(v => v.election);
    const unique = elections.filter((election, index, self) =>
      index === self.findIndex(e => e.id === election.id)
    );
    return unique;
  };

  const getFilteredAndSortedVotes = () => {
    let filtered = votes;

    // Recherche texte: nom/prénom candidat, titre élection, poste
    if (votesSearchTerm) {
      const q = votesSearchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        `${v.candidacy.adherent.firstname} ${v.candidacy.adherent.lastname}`.toLowerCase().includes(q) ||
        v.election.titre?.toLowerCase().includes(q) ||
        v.position.titre?.toLowerCase().includes(q)
      );
    }

    // Filtre élection
    if (votesSelectedElection !== 'all') {
      filtered = filtered.filter(v => v.election.id === votesSelectedElection);
    }

    // Tri
    filtered.sort((a, b) => {
      switch (votesSortBy) {
        case 'name': {
          const aName = `${a.candidacy.adherent.firstname} ${a.candidacy.adherent.lastname}`.toLowerCase();
          const bName = `${b.candidacy.adherent.firstname} ${b.candidacy.adherent.lastname}`.toLowerCase();
          return aName.localeCompare(bName);
        }
        case 'election':
          return a.election.titre.localeCompare(b.election.titre);
        case 'position':
          return a.position.titre.localeCompare(b.position.titre);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  };

  const getGroupedVotes = () => {
    const filtered = getFilteredAndSortedVotes();
    if (!votesGroupByElection) {
      return { 'Tous les votes': filtered };
    }
    const grouped = filtered.reduce((acc: Record<string, any[]>, v: any) => {
      const title = v.election.titre;
      if (!acc[title]) acc[title] = [];
      acc[title].push(v);
      return acc;
    }, {} as Record<string, any[]>);
    return grouped;
  };

  // Données par défaut si certaines propriétés ne sont pas disponibles
  const userStatus = (user as any)?.status || 'Actif';
  const userRole = (user as any)?.role || 'MEMBRE';
  const userCreatedAt = (user as any)?.createdAt || new Date().toISOString();
  const userLastLogin = (user as any)?.lastLogin || null;

  // Menu latéral - tous les menus
  const allMenuItems = [
    {
      id: 'profile' as MenuSection,
      label: 'Mon Profil',
      icon: User,
      description: 'Informations personnelles',
      electoral: false
    },
    {
      id: 'cotisations' as MenuSection,
      label: 'Mes Cotisations',
      icon: Euro,
      description: 'Cotisations et obligations',
      electoral: false
    },
    {
      id: 'taches' as MenuSection,
      label: 'Mes Tâches',
      icon: FileText,
      description: 'Voir et suivre mes tâches assignées',
      electoral: false
    },
    {
      id: 'projets' as MenuSection,
      label: 'Projets Amaki',
      icon: FolderKanban,
      description: 'Consulter les projets de l\'association',
      electoral: false
    },
    {
      id: 'documents' as MenuSection,
      label: 'Mes Documents',
      icon: FileText,
      description: 'Gérer mes documents',
      electoral: false
    },
    {
      id: 'rapports' as MenuSection,
      label: 'Rapports de Réunion',
      icon: FileText,
      description: 'Consulter les rapports de réunion',
      electoral: false
    },
    {
      id: 'badges' as MenuSection,
      label: 'Mes Badges',
      icon: Award,
      description: 'Mes récompenses et badges',
      electoral: false
    },
    {
      id: 'passeport' as MenuSection,
      label: 'Mon Passeport',
      icon: Shield,
      description: 'Droits et obligations',
      electoral: false
    },
    {
      id: 'statistiques' as MenuSection,
      label: 'Statistiques',
      icon: BarChart3,
      description: 'Mes statistiques personnelles',
      electoral: false
    },
    {
      id: 'enfants' as MenuSection,
      label: 'Mes Enfants',
      icon: Baby,
      description: 'Gérer mes enfants',
      electoral: false
    },
    {
      id: 'idees' as MenuSection,
      label: 'Mes Idées',
      icon: Lightbulb,
      description: 'Gérer mes idées',
      electoral: false
    },
    {
      id: 'candidatures' as MenuSection,
      label: 'Mes Candidatures',
      icon: Vote,
      description: 'Candidatures soumises',
      electoral: true
    },
    {
      id: 'votes' as MenuSection,
      label: 'Mes Votes',
      icon: Vote,
      description: 'Historique des votes',
      electoral: true
    },
    {
      id: 'candidates' as MenuSection,
      label: 'Liste des Candidats',
      icon: Users,
      description: 'Voir tous les candidats',
      electoral: true
    },
    {
      id: 'notifications' as MenuSection,
      label: 'Notifications',
      icon: Bell,
      description: 'Préférences de notifications',
      electoral: false
    },
    {
      id: 'settings' as MenuSection,
      label: 'Paramètres',
      icon: Settings,
      description: 'Gestion du compte',
      electoral: false
    }
  ];

  // Les menus sont maintenant affichés en fonction de leur propriété 'electoral'
  // Pour désactiver les menus électoraux, utilisez /admin/settings
  // Le menu "taches" est visible pour tous - la vérification du profil adhérent se fera dans la section elle-même
  const menuItems = allMenuItems;

  // Fonction pour rendre le contenu de chaque section
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            {/* En-tête de section avec bouton principal */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Mon Profil</h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">Gérez vos informations personnelles</p>
              </div>
              {!isViewAsMode && (
                <Link href="/user/update" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white">
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier le profil
                  </Button>
                </Link>
              )}
            </div>

            {/* Informations de base */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Informations Personnelles
                </CardTitle>
                <CardDescription>
                  Vos informations de base et de contact
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{displayUser?.email || "Non renseigné"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Nom complet</p>
                      <p className="font-medium">{displayUser?.name || "Non renseigné"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Membre depuis</p>
                      <p className="font-medium">
                        {new Date(userCreatedAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Dernière connexion</p>
                      <p className="font-medium">
                        {userLastLogin ? 
                          format(new Date(userLastLogin), "d MMMM yyyy à HH:mm", { locale: fr }) :
                          "Jamais"
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informations Adhérent */}
            {effectiveLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Informations Adhérent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : effectiveProfile?.adherent ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Informations Adhérent
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Civilité</span>
                    <span className="font-medium">{effectiveProfile?.adherent?.civility || "Non renseigné"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Prénom</span>
                    <span className="font-medium">{effectiveProfile?.adherent?.firstname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Nom</span>
                    <span className="font-medium">{effectiveProfile?.adherent?.lastname}</span>
                  </div>
                </CardContent>
              </Card> 
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Informations Adhérent
                  </CardTitle>
                  <CardDescription>
                    Aucune information d'adhérent disponible
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300">
                      Complétez vos informations d'adhérent
                    </p>
                    {!isViewAsMode && (
                    <Link href="/user/update">
                      <Button className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        Compléter mon profil
                      </Button>
                    </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informations d'Adresse */}
            {effectiveLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Adresses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : effectiveProfile?.adherent?.Adresse && effectiveProfile.adherent.Adresse.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Adresses
                  </CardTitle>
                  <CardDescription>
                    Vos adresses enregistrées
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {effectiveProfile.adherent.Adresse.map((adresse, index) => (
                    <div key={adresse.id} className="border rounded-lg p-4 space-y-3">
                      {index > 0 && <hr className="my-4" />}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Numéro</p>
                            <p className="font-medium">{adresse.streetnum || "Non renseigné"}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Home className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Rue</p>
                            <p className="font-medium">{adresse.street1 || "Non renseigné"}</p>
                          </div>
                        </div>
                      </div>

                      {adresse.street2 && (
                        <div className="flex items-center gap-3">
                          <Building className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Complément</p>
                            <p className="font-medium">{adresse.street2}</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Code postal</p>
                            <p className="font-medium">{adresse.codepost || "Non renseigné"}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Ville</p>
                            <p className="font-medium">{adresse.city || "Non renseigné"}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Pays</p>
                            <p className="font-medium">{adresse.country || "Non renseigné"}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t">
                        <div className="text-xs text-gray-500">
                          Créée le {new Date(adresse.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Edit className="h-3 w-3" />
                          <span>Modifiable</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Adresses
                  </CardTitle>
                  <CardDescription>
                    Aucune adresse enregistrée
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      Ajoutez votre adresse pour compléter votre profil
                    </p>
                    {!isViewAsMode && (
                    <Link href="/user/update">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter une adresse
                      </Button>
                    </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informations des Téléphones */}
            {effectiveLoading ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    Téléphones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ) : effectiveProfile?.adherent?.Telephones && effectiveProfile.adherent.Telephones.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    Téléphones
                  </CardTitle>
                  <CardDescription>
                    Vos numéros de téléphone
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {effectiveProfile.adherent.Telephones.map((telephone, index) => (
                    <div key={telephone.id} className="border rounded-lg p-4 space-y-3">
                      {index > 0 && <hr className="my-4" />}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Numéro</p>
                            <p className="font-medium text-lg">{telephone.numero}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {telephone.estPrincipal && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Principal
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {telephone.type}
                          </Badge>
                        </div>
                      </div>

                      {telephone.description && (
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm text-gray-500">Description</p>
                            <p className="font-medium text-sm">{telephone.description}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t">
                        <div className="text-xs text-gray-500">
                          Ajouté le {new Date(telephone.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Edit className="h-3 w-3" />
                          <span>Modifiable</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    Téléphones
                  </CardTitle>
                  <CardDescription>
                    Aucun numéro de téléphone enregistré
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      Ajoutez vos numéros de téléphone pour être contacté
                    </p>
                    {!isViewAsMode && (
                    <Link href="/user/update">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter un téléphone
                      </Button>
                    </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Note explicative */}
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                      <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      Comment modifier vos informations ?
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Utilisez le bouton <strong>"Modifier le profil"</strong> en haut de cette page pour accéder au formulaire de modification. 
                      Vous pourrez y modifier toutes vos informations : adhérent, adresses et téléphones.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'cotisations':
        return (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mes Cotisations</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">Historique des cotisations et obligations</p>
              </div>
            </div>

            {/* Afficher les avoirs disponibles */}
            {avoirs.length > 0 && (
              <Card className="border-green-200 dark:border-green-800 bg-white dark:bg-gray-900 !py-0">
                <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white pb-3 pt-3 px-6 gap-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-4 w-4" />
                    Mes Avoirs (Crédits Disponibles)
                  </CardTitle>
                  <CardDescription className="text-green-100 dark:text-green-200 mt-1 text-xs">
                    Crédits disponibles à utiliser pour vos prochains paiements
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-3 pb-4 px-6">
                  <div className="space-y-2">
                    {avoirs.map((avoir: any) => (
                      <div key={avoir.id} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                              {avoir.description || "Avoir disponible"}
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                              Créé le {format(new Date(avoir.createdAt), "dd MMMM yyyy", { locale: fr })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              {avoir.montantRestant.toFixed(2).replace('.', ',')} €
                            </p>
                            {avoir.montantUtilise > 0 && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                Utilisé: {avoir.montantUtilise.toFixed(2).replace('.', ',')} €
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-0.5">
                            Comment utiliser vos avoirs ?
                          </p>
                          <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                            Vos avoirs sont automatiquement appliqués lors de vos prochains paiements. 
                            Ils réduiront le montant à payer pour vos cotisations et dettes.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Afficher les dettes initiales en premier sous forme de table */}
            {dettesInitiales.length > 0 && (
              <Card className="border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 !py-0">
                <CardHeader className="bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white pb-3 pt-3 px-6 gap-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertCircle className="h-4 w-4" />
                    Dettes Initiales
                  </CardTitle>
                  <CardDescription className="text-red-100 dark:text-red-200 mt-1 text-xs">
                    Dettes de l'adhérent envers l'association (2024, 2025, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-3 pb-4 px-6">
                  <DettesInitialesTable dettes={dettesInitiales} />
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-0.5">
                          Information importante
                        </p>
                        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                          Ces dettes initiales représentent votre dette envers l'association pour les années précédentes (2024, 2025, etc.). 
                          Vous pouvez effectuer des paiements partiels ou complets pour régulariser votre situation. 
                          L'application a été mise en place le 1er janvier, ces dettes correspondent donc aux années antérieures.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sélecteur : Un mois / Une année / Toutes */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Afficher :</span>
              <Select
                value={cotisationsVue}
                onValueChange={(v: 'mois' | 'annee' | 'toutes') => setCotisationsVue(v)}
              >
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mois">Un mois</SelectItem>
                  <SelectItem value="annee">Une année</SelectItem>
                  <SelectItem value="toutes">Toutes les cotisations</SelectItem>
                </SelectContent>
              </Select>
              {cotisationsVue === 'mois' && (
                <>
                  <Popover open={calendarCotisationsOpen} onOpenChange={setCalendarCotisationsOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-[180px] justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {format(new Date(selectedCotisationsAnnee, selectedCotisationsMois - 1, 1), "MMMM yyyy", { locale: fr }).replace(/^\w/, (c) => c.toUpperCase())}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" align="start">
                      <CalendarUI
                        mode="single"
                        selected={new Date(selectedCotisationsAnnee, selectedCotisationsMois - 1, 1)}
                        onSelect={(date) => {
                          if (date) {
                            setSelectedCotisationsAnnee(date.getFullYear());
                            setSelectedCotisationsMois(date.getMonth() + 1);
                            setCalendarCotisationsOpen(false);
                          }
                        }}
                        defaultMonth={new Date(selectedCotisationsAnnee, selectedCotisationsMois - 1, 1)}
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-blue-600 dark:text-blue-400"
                    onClick={() => {
                      const n = new Date();
                      setSelectedCotisationsMois(n.getMonth() + 1);
                      setSelectedCotisationsAnnee(n.getFullYear());
                    }}
                  >
                    Mois en cours
                  </Button>
                </>
              )}
              {cotisationsVue === 'annee' && (
                <>
                  <Select
                    value={String(selectedCotisationsAnnee)}
                    onValueChange={(v) => setSelectedCotisationsAnnee(Number(v))}
                  >
                    <SelectTrigger className="w-[90px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const currentYear = new Date().getFullYear();
                        const years = [];
                        for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y);
                        return years.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-blue-600 dark:text-blue-400"
                    onClick={() => setSelectedCotisationsAnnee(new Date().getFullYear())}
                  >
                    Année en cours
                  </Button>
                </>
              )}
            </div>

            {/* Carte cotisations selon le mode */}
            {(() => {
              let title = '';
              let description = '';
              if (cotisationsVue === 'mois') {
                const nomMois = new Date(selectedCotisationsAnnee, selectedCotisationsMois - 1, 1)
                  .toLocaleDateString('fr-FR', { month: 'long' });
                const nomMoisCap = nomMois.charAt(0).toUpperCase() + nomMois.slice(1);
                title = `Cotisations du mois de ${nomMoisCap} ${selectedCotisationsAnnee}`;
                description = 'Cotisations mensuelles + assistances du mois';
              } else if (cotisationsVue === 'annee') {
                title = `Cotisations de l'année ${selectedCotisationsAnnee}`;
                description = 'Toutes les cotisations mensuelles et assistances de l\'année';
              } else {
                title = 'Toutes mes cotisations';
                description = 'Toutes vos cotisations mensuelles et assistances';
              }
              return (
                <Card className="border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 !py-0">
                  <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white pb-3 pt-3 px-6 gap-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Receipt className="h-4 w-4" />
                      {title}
                    </CardTitle>
                    <CardDescription className="text-blue-100 dark:text-blue-200 mt-1 text-xs">
                      {description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-3 pb-4 px-6">
                    <CotisationsMoisTable cotisations={cotisationsMoisAffichage} vueCotisations={cotisationsVue} />
                  </CardContent>
                </Card>
              );
            })()}

            {/* Historique des cotisations par mois (toujours affiché) */}
            {historiqueCotisations.length > 0 && (
              <Card className="border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 !py-0">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white pb-3 pt-3 px-6 gap-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-4 w-4" />
                    Historique des Cotisations par Mois
                  </CardTitle>
                  <CardDescription className="text-indigo-100 dark:text-indigo-200 mt-1 text-xs">
                    Détail de vos cotisations mensuelles et paiements effectués
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-3 pb-4 px-6">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Période</Label>
                    <Popover open={historiqueCalendarOpen} onOpenChange={setHistoriqueCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-[200px] justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {historiqueFilterMois === 'all' || historiqueFilterAnnee === 'all'
                            ? 'Tous les mois et années'
                            : format(new Date(Number(historiqueFilterAnnee), Number(historiqueFilterMois) - 1, 1), "MMMM yyyy", { locale: fr }).replace(/^\w/, (c) => c.toUpperCase())}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" align="start">
                        <CalendarUI
                          mode="single"
                          selected={historiqueFilterMois !== 'all' && historiqueFilterAnnee !== 'all'
                            ? new Date(Number(historiqueFilterAnnee), Number(historiqueFilterMois) - 1, 1)
                            : undefined}
                          onSelect={(date) => {
                            if (date) {
                              setHistoriqueFilterMois(String(date.getMonth() + 1));
                              setHistoriqueFilterAnnee(String(date.getFullYear()));
                              setHistoriqueCalendarOpen(false);
                            }
                          }}
                          defaultMonth={historiqueFilterMois !== 'all' && historiqueFilterAnnee !== 'all'
                            ? new Date(Number(historiqueFilterAnnee), Number(historiqueFilterMois) - 1, 1)
                            : new Date()}
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-indigo-600 dark:text-indigo-400"
                      onClick={() => {
                        setHistoriqueFilterMois('all');
                        setHistoriqueFilterAnnee('all');
                      }}
                    >
                      Voir tout
                    </Button>
                  </div>
                  <HistoriqueCotisationsTable cotisations={filteredHistoriqueCotisations} />
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'candidatures':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mes Candidatures</h2>
                <p className="text-gray-600 dark:text-gray-300">Historique de vos candidatures</p>
              </div>
              <Link href="/candidatures">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle candidature
                </Button>
              </Link>
            </div>

            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : candidatures.length > 0 ? (
              <div className="space-y-4">
                {candidatures.map((candidacy) => (
                  <Card key={candidacy.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {candidacy.position.titre}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {candidacy.election.titre}
                          </p>
                        </div>
                        <Badge className={getCandidacyStatusColor(candidacy.status)}>
                          {candidacy.status === 'Validee' ? 'Validée' : 
                           candidacy.status === 'EnAttente' ? 'En attente' : 'Rejetée'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-300">Date de candidature:</span>
                          <span className="ml-2 font-medium">
                            {new Date(candidacy.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-300">Statut de l'élection:</span>
                          <Badge className={`ml-2 text-xs ${getElectionStatusColor(candidacy.election.status)}`}>
                            {candidacy.election.status === 'Ouverte' ? 'Ouverte' :
                             candidacy.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                          </Badge>
                        </div>
                      </div>

                      {candidacy.motivation && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Motivation:</p>
                          <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                            {candidacy.motivation}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Aucune candidature
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Vous n'avez pas encore soumis de candidature.
                  </p>
                  <Link href="/candidatures">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Soumettre une candidature
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'votes':
        const groupedVotes = getGroupedVotes();
        const uniqueVoteElections = getUniqueElectionsFromVotes();
        const votesCount = getFilteredAndSortedVotes().length;
        return (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Mes Votes</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{votesCount} vote{votesCount > 1 ? 's' : ''} trouvé{votesCount > 1 ? 's' : ''}</p>
              </div>
              <div className="flex gap-2">
                <Link href="/vote">
                  <Button>
                    <Vote className="h-4 w-4 mr-2" />
                    Voter maintenant
                  </Button>
                </Link>
                <Button
                  variant={votesGroupByElection ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVotesGroupByElection(!votesGroupByElection)}
                >
                  {votesGroupByElection ? <Grid3X3 className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
                  {votesGroupByElection ? 'Groupé' : 'Liste'}
                </Button>
              </div>
            </div>

            {/* Barre de recherche et filtres */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Recherche */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un vote (nom, poste, élection)..."
                      value={votesSearchTerm}
                      onChange={(e) => setVotesSearchTerm(e.target.value)}
                      className="w-full pl-28 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {votesSearchTerm && (
                      <button
                        onClick={() => setVotesSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Filtre élection */}
                  <select
                    value={votesSelectedElection}
                    onChange={(e) => setVotesSelectedElection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Toutes les élections</option>
                    {uniqueVoteElections.map((election: any) => (
                      <option key={election.id} value={election.id}>{election.titre}</option>
                    ))}
                  </select>

                  {/* Tri */}
                  <select
                    value={votesSortBy}
                    onChange={(e) => setVotesSortBy(e.target.value as 'date' | 'name' | 'election' | 'position')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="date">Tri par date</option>
                    <option value="name">Tri par nom candidat</option>
                    <option value="position">Tri par poste</option>
                    <option value="election">Tri par élection</option>
                  </select>

                  {/* Bouton reset filtres */}
                  <div className="flex items-center">
                    {(votesSearchTerm || votesSelectedElection !== 'all' || votesSortBy !== 'date') && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setVotesSearchTerm('');
                          setVotesSelectedElection('all');
                          setVotesSortBy('date');
                        }}
                        className="w-full"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Effacer les filtres
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contenu principal */}
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : Object.keys(groupedVotes).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(groupedVotes).map(([electionTitle, votesInElection]) => {
                  const votesList = votesInElection as any[];
                  return (
                    <div key={electionTitle}>
                      {votesGroupByElection && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{electionTitle}</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300">{votesList.length} vote{votesList.length > 1 ? 's' : ''}</p>
                          </div>
                          <Badge className={getElectionStatusColor(votesList[0]?.election.status)}>
                            {votesList[0]?.election.status === 'Ouverte' ? 'Ouverte' : votesList[0]?.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                          </Badge>
                        </div>
                      )}

                      <div className="space-y-2">
                        {votesList.map((vote: any) => (
                          <Card key={vote.id} className="hover:shadow-md transition-shadow py-0!">
                            <CardContent className="p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{vote.position.titre}</h3>
                                  {!votesGroupByElection && (
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{vote.election.titre}</p>
                                  )}
                                </div>
                                <Badge className={`text-xs ${getElectionStatusColor(vote.election.status)}`}>
                                  {vote.election.status === 'Ouverte' ? 'Ouverte' : vote.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-3 mb-2">
                                <Avatar className="w-10 h-10 flex-shrink-0">
                                  <AvatarImage src={vote.candidacy?.adherent?.User?.image || undefined} alt={`${vote.candidacy?.adherent?.firstname || ''} ${vote.candidacy?.adherent?.lastname || ''}`} />
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs">
                                    {vote.candidacy?.adherent?.firstname?.[0] || ''}{vote.candidacy?.adherent?.lastname?.[0] || ''}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{vote.candidacy?.adherent?.firstname || ''} {vote.candidacy?.adherent?.lastname || ''}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-300">{vote.candidacy?.adherent?.civility || ''}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Date:</span>
                                  <span className="ml-1 font-medium">{new Date(vote.createdAt).toLocaleDateString('fr-FR')}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Heure:</span>
                                  <span className="ml-1 font-medium">{new Date(vote.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Candidat:</span>
                                  <span className="ml-1 font-medium truncate">{vote.candidacy?.adherent?.firstname || ''} {vote.candidacy?.adherent?.lastname || ''}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card className="py-0!">
                <CardContent className="p-4 text-center">
                  <Vote className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Aucun vote</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Vous n'avez pas encore voté dans une élection.</p>
                  <Link href="/vote">
                    <Button size="sm">
                      <Vote className="h-4 w-4 mr-2" />
                      Voter maintenant
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'candidates':
        const groupedCandidates = getGroupedCandidates();
        const uniqueElections = getUniqueElections();
        const filteredCount = getFilteredAndSortedCandidates().length;

        return (
          <div className="space-y-3">
            {/* En-tête avec titre et statistiques */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Liste des Candidats</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {filteredCount} candidat{filteredCount > 1 ? 's' : ''} trouvé{filteredCount > 1 ? 's' : ''}
                  {searchTerm && ` pour "${searchTerm}"`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={groupByElection ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setGroupByElection(!groupByElection)}
                >
                  {groupByElection ? <Grid3X3 className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
                  {groupByElection ? 'Groupé' : 'Liste'}
                </Button>
              </div>
            </div>

            {/* Barre de recherche et filtres */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Recherche textuelle */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher un candidat..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-28 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Filtre par élection */}
                  <select
                    value={selectedElection}
                    onChange={(e) => setSelectedElection(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Toutes les élections</option>
                    {uniqueElections.map((election) => (
                      <option key={election.id} value={election.id}>
                        {election.titre}
                      </option>
                    ))}
                  </select>

                  {/* Filtre par statut */}
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="Validee">Validées</option>
                    <option value="EnAttente">En attente</option>
                    <option value="Rejetee">Rejetées</option>
                  </select>

                  {/* Tri */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'election')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="date">Tri par date</option>
                    <option value="name">Tri par nom</option>
                    <option value="election">Tri par élection</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Contenu principal */}
            {loading ? (
              <Card>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ) : Object.keys(groupedCandidates).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(groupedCandidates).map(([electionTitle, candidatesInElection]) => {
                  const candidates = candidatesInElection as any[];
                  return (
                    <div key={electionTitle}>
                      {/* En-tête de groupe */}
                      {groupByElection && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                              {electionTitle}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300">
                              {candidates.length} candidat{candidates.length > 1 ? 's' : ''}
                            </p>
                          </div>
                          <Badge className={getElectionStatusColor(candidates[0]?.election.status)}>
                            {candidates[0]?.election.status === 'Ouverte' ? 'Ouverte' :
                             candidates[0]?.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                          </Badge>
                        </div>
                      )}

                      {/* Liste des candidats */}
                      <div className="space-y-2">
                        {candidates.map((candidate: any) => (
                        <Card key={candidate.id} className="hover:shadow-md transition-shadow py-0!">
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3 mb-2">
                              <Avatar className="w-12 h-12 flex-shrink-0">
                                <AvatarImage
                                  src={candidate.adherent?.User?.image || undefined}
                                  alt={`${candidate.adherent?.firstname || ''} ${candidate.adherent?.lastname || ''}`}
                                />
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                                  {candidate.adherent?.firstname?.[0] || ''}{candidate.adherent?.lastname?.[0] || ''}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                  {candidate.adherent?.firstname || ''} {candidate.adherent?.lastname || ''}
                                </h3>
                                <p className="text-xs text-gray-600 dark:text-gray-300">
                                  {candidate.adherent?.civility || ''}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {candidate.adherent?.User?.email || ''}
                                </p>
                              </div>
                              <div className="text-right space-y-1 flex-shrink-0">
                                <Badge className={`text-xs ${getCandidacyStatusColor(candidate.status)}`}>
                                  {candidate.status === 'Validee' ? 'Validée' : 
                                   candidate.status === 'EnAttente' ? 'En attente' : 'Rejetée'}
                                </Badge>
                                {!groupByElection && (
                                  <Badge className={`text-xs ${getElectionStatusColor(candidate.election.status)}`}>
                                    {candidate.election.status === 'Ouverte' ? 'Ouverte' :
                                     candidate.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-600 dark:text-gray-300">Poste:</span>
                                <span className="ml-1 font-medium">{candidate.position?.titre || ''}</span>
                              </div>
                              {!groupByElection && (
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Élection:</span>
                                  <span className="ml-1 font-medium truncate">{candidate.election?.titre || ''}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-600 dark:text-gray-300">Date:</span>
                                <span className="ml-1 font-medium">
                                  {new Date(candidate.createdAt).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-300">Heure:</span>
                                <span className="ml-1 font-medium">
                                  {new Date(candidate.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>

                            {candidate.motivation && (
                              <div className="mt-2">
                                <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">Motivation:</p>
                                <p className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded-lg line-clamp-2">
                                  {candidate.motivation}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card className="py-0!">
                <CardContent className="p-4 text-center">
                  <Users className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                    {searchTerm || selectedElection !== 'all' || selectedStatus !== 'all' 
                      ? 'Aucun résultat' 
                      : 'Aucun candidat'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    {searchTerm || selectedElection !== 'all' || selectedStatus !== 'all'
                      ? 'Aucun candidat ne correspond à vos critères de recherche.'
                      : 'Aucune candidature n\'a été soumise pour le moment.'}
                  </p>
                  {(searchTerm || selectedElection !== 'all' || selectedStatus !== 'all') && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedElection('all');
                        setSelectedStatus('all');
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Effacer les filtres
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'documents':
        const getDocumentIcon = (type: TypeDocument) => {
          switch (type) {
            case TypeDocument.PDF:
              return FileText;
            case TypeDocument.Image:
              return Image;
            case TypeDocument.Video:
              return Video;
            case TypeDocument.Excel:
              return TableIcon;
            case TypeDocument.Word:
              return FileText;
            default:
              return File;
          }
        };

        const getDocumentColor = (type: TypeDocument) => {
          switch (type) {
            case TypeDocument.PDF:
              return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
            case TypeDocument.Image:
              return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
            case TypeDocument.Video:
              return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
            case TypeDocument.Excel:
              return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
            case TypeDocument.Word:
              return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
            default:
              return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
          }
        };

        const formatFileSize = (bytes: number) => {
          if (bytes === 0) return "0 Bytes";
          const k = 1024;
          const sizes = ["Bytes", "KB", "MB", "GB"];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
        };

        const handleDeleteDocument = async (documentId: string) => {
          if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) {
            return;
          }

          const result = await deleteDocument(documentId);
          if (result.success) {
            setDocuments((prev) => prev.filter((d) => d.id !== documentId));
            toast.success("Document supprimé avec succès");
          } else {
            toast.error(result.error || "Erreur lors de la suppression");
          }
        };

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  Mes Documents
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                  Gérez tous vos documents en un seul endroit
                </p>
              </div>
              <Link href="/user/documents" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10">
                  <Plus className="h-4 w-4 mr-2" />
                  Gérer mes documents
                </Button>
              </Link>
            </div>

            {documentsLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </CardContent>
              </Card>
            ) : documents.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileText className="h-16 w-16 text-gray-400 mb-4" />
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-4">
                      Aucun document uploadé
                    </p>
                    <Link href="/user/documents">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10">
                        <Upload className="h-4 w-4 mr-2" />
                        Uploader votre premier document
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">
                    Mes Documents ({documents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {documents.slice(0, 5).map((document) => {
                      const IconComponent = getDocumentIcon(document.type);
                      return (
                        <div
                          key={document.id}
                          className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className={`p-2 sm:p-3 rounded-lg flex-shrink-0 ${getDocumentColor(document.type)}`}>
                            <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
                              {document.nomOriginal}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-xs ${getDocumentColor(document.type)}`}
                              >
                                {document.type}
                              </Badge>
                              {document.categorie && (
                                <Badge variant="outline" className="text-xs">
                                  {document.categorie}
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatFileSize(document.taille)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            <a
                              href={document.chemin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Voir"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                            <a
                              href={document.chemin}
                              download
                              className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Télécharger"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDocument(document.id)}
                              className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {documents.length > 5 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <Link href="/user/documents">
                        <Button variant="outline" className="w-full text-sm h-9 sm:h-10">
                          Voir tous les documents ({documents.length})
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'rapports':
        const handleViewRapport = async (rapport: any) => {
          try {
            const result = await getRapportReunionById(rapport.id);
            if (result.success && result.rapport) {
              setSelectedRapport(result.rapport);
              setShowRapportDialog(true);
            } else {
              toast.error(result.error || "Erreur lors du chargement");
            }
          } catch (error) {
            console.error("Erreur:", error);
            toast.error("Erreur lors du chargement du rapport");
          }
        };

        const handlePrintRapport = (rapport: any) => {
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            toast.error("Impossible d'ouvrir la fenêtre d'impression");
            return;
          }

          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${rapport.titre}</title>
                <style>
                  body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                  }
                  h1 {
                    color: #1e40af;
                    border-bottom: 2px solid #1e40af;
                    padding-bottom: 10px;
                  }
                  .meta {
                    color: #666;
                    margin-bottom: 20px;
                  }
                  .contenu {
                    line-height: 1.6;
                    white-space: pre-wrap;
                  }
                  @media print {
                    body {
                      padding: 0;
                    }
                  }
                </style>
              </head>
              <body>
                <h1>${rapport.titre}</h1>
                <div class="meta">
                  <p><strong>Date de la réunion :</strong> ${format(new Date(rapport.dateReunion), "dd MMMM yyyy", { locale: fr })}</p>
                  <p><strong>Créé le :</strong> ${format(new Date(rapport.createdAt), "dd MMMM yyyy à HH:mm", { locale: fr })}</p>
                  ${rapport.CreatedBy ? `<p><strong>Créé par :</strong> ${rapport.CreatedBy.name || rapport.CreatedBy.email}</p>` : ''}
                </div>
                <div class="contenu">${rapport.contenu}</div>
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 250);
        };

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  Rapports de Réunion
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                  Consultez les comptes rendus de nos réunions mensuelles
                </p>
              </div>
            </div>

            {rapportsLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </CardContent>
              </Card>
            ) : rapports.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileText className="h-16 w-16 text-gray-400 mb-4" />
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-2">
                      Aucun rapport disponible pour le moment
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {rapports.map((rapport) => (
                  <Card key={rapport.id} className="border-gray-200 hover:border-blue-300 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {rapport.titre}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {format(new Date(rapport.dateReunion), "dd MMMM yyyy", { locale: fr })}
                              </span>
                            </div>
                            {rapport.CreatedBy && (
                              <span>
                                Par {rapport.CreatedBy.name || "Administrateur"}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 line-clamp-2">
                            {rapport.contenu.substring(0, 200)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewRapport(rapport)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Lire
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintRapport(rapport)}
                          >
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimer
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Dialog de visualisation */}
            <Dialog open={showRapportDialog} onOpenChange={setShowRapportDialog}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{selectedRapport?.titre}</DialogTitle>
                </DialogHeader>
                <div className="space-y-1 mt-2 text-sm text-muted-foreground">
                  <p><strong>Date de la réunion :</strong> {selectedRapport && format(new Date(selectedRapport.dateReunion), "dd MMMM yyyy", { locale: fr })}</p>
                  <p><strong>Créé le :</strong> {selectedRapport && format(new Date(selectedRapport.createdAt), "dd MMMM yyyy à HH:mm", { locale: fr })}</p>
                  {selectedRapport?.CreatedBy && (
                    <p><strong>Créé par :</strong> {selectedRapport.CreatedBy.name || selectedRapport.CreatedBy.email}</p>
                  )}
                </div>
                <div className="mt-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg whitespace-pre-wrap text-sm">
                    {selectedRapport?.contenu}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowRapportDialog(false)}>
                    Fermer
                  </Button>
                  {selectedRapport && (
                    <Button onClick={() => handlePrintRapport(selectedRapport)}>
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimer
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );

      case 'badges':
        const getBadgeIcon = (iconName: string) => {
          const IconComponent = (LucideIcons as any)[iconName] || Award;
          return IconComponent;
        };

        const getBadgeColorClass = (couleur: string) => {
          const colorMap: Record<string, string> = {
            blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700",
            green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700",
            purple: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700",
            orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700",
            yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700",
            red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700",
            indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700",
            pink: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200 border-pink-300 dark:border-pink-700",
            slate: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 border-slate-300 dark:border-slate-700",
            gold: "bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100 border-yellow-400 dark:border-yellow-600",
          };
          return colorMap[couleur] || colorMap.blue;
        };

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Award className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  Mes Badges
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                  Vos récompenses et accomplissements dans l'association
                </p>
              </div>
            </div>

            {badgesLoading ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </CardContent>
              </Card>
            ) : badges.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Award className="h-16 w-16 text-gray-400 mb-4" />
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-2">
                      Vous n'avez pas encore de badges
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">
                      Participez aux activités de l'association pour débloquer vos premiers badges !
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {badges.map((attribution) => {
                  const badge = attribution.Badge;
                  const IconComponent = getBadgeIcon(badge.icone);
                  return (
                    <Card key={attribution.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col items-center text-center space-y-3">
                          <div className={`p-4 sm:p-6 rounded-full ${getBadgeColorClass(badge.couleur)}`}>
                            <IconComponent className="h-8 w-8 sm:h-10 sm:w-10" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                              {badge.nom}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {badge.description}
                            </p>
                          </div>
                          {attribution.raison && (
                            <div className="w-full pt-2 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                "{attribution.raison}"
                              </p>
                            </div>
                          )}
                          <div className="w-full pt-2 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Obtenu le {format(new Date(attribution.createdAt), "dd MMMM yyyy", { locale: fr })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'statistiques':
        // Calculer les statistiques
        const totalCotisations = cotisations.length;
        const totalCotisationsPayees = cotisations.filter((c: any) => {
          const restant = Number(c.montantRestant || 0);
          return restant === 0;
        }).length;
        const totalIdees = idees.length;
        const totalIdeesValidees = idees.filter((i: any) => i.statut === 'Validee').length;
        const totalDocuments = documents.length;
        const totalVotes = votes.length;
        const totalCandidatures = candidatures.length;
        const totalDette = dettesInitiales.reduce((sum: number, d: any) => sum + Number(d.montantRestant || 0), 0);
        const totalAvoir = avoirs.reduce((sum: number, a: any) => sum + Number(a.montantRestant || 0), 0);
        const totalEnfants = enfants.length;

        // Calculer l'ancienneté
        const dateAdhesion = userProfile?.adherent?.datePremiereAdhesion 
          ? new Date((effectiveProfile?.adherent as any)?.datePremiereAdhesion)
          : userCreatedAt ? new Date(userCreatedAt) : new Date();
        const ancienneteAnnees = differenceInYears(new Date(), dateAdhesion);
        const ancienneteMois = differenceInMonths(new Date(), dateAdhesion) % 12;

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                Mes Statistiques Personnelles
              </h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                Vue d'ensemble de votre activité dans l'association
              </p>
            </div>

            {/* Cartes de statistiques principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card className="!py-0 border-2 border-blue-200 dark:border-blue-800/50">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 sm:py-4">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Euro className="h-4 w-4 sm:h-5 sm:w-5" />
                    Cotisations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {totalCotisationsPayees}/{totalCotisations}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Payées / Total
                  </p>
                </CardContent>
              </Card>

              <Card className="!py-0 border-2 border-purple-200 dark:border-purple-800/50">
                <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 sm:py-4">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5" />
                    Idées
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {totalIdeesValidees}/{totalIdees}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Validées / Total
                  </p>
                </CardContent>
              </Card>

              <Card className="!py-0 border-2 border-green-200 dark:border-green-800/50">
                <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white py-3 sm:py-4">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                    Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {totalDocuments}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Documents uploadés
                  </p>
                </CardContent>
              </Card>

              <Card className="!py-0 border-2 border-orange-200 dark:border-orange-800/50">
                <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 sm:py-4">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Vote className="h-4 w-4 sm:h-5 sm:w-5" />
                    Votes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {totalVotes}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Votes exprimés
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Statistiques financières */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <Card className="!py-0 border-2 border-red-200 dark:border-red-800/50">
                <CardHeader className="bg-gradient-to-r from-red-500 to-red-600 text-white py-3 sm:py-4">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    Dette Totale
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {totalDette.toFixed(2).replace('.', ',')} €
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Montant restant à payer
                  </p>
                </CardContent>
              </Card>

              <Card className="!py-0 border-2 border-emerald-200 dark:border-emerald-800/50">
                <CardHeader className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 sm:py-4">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                    Avoir
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {totalAvoir.toFixed(2).replace('.', ',')} €
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Crédit disponible
                  </p>
                </CardContent>
              </Card>

              <Card className="!py-0 border-2 border-indigo-200 dark:border-indigo-800/50">
                <CardHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white py-3 sm:py-4">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    Ancienneté
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {ancienneteAnnees} an{ancienneteAnnees > 1 ? 's' : ''}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {ancienneteMois > 0 && `${ancienneteMois} mois`}
                    {ancienneteMois === 0 && 'Membre depuis'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Statistiques détaillées */}
            <Card className="!py-0">
              <CardHeader className="bg-gradient-to-r from-slate-500 to-slate-600 text-white py-3 sm:py-4">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                  Détails de l'Activité
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <div className="space-y-1">
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Candidatures</div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{totalCandidatures}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Enfants</div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{totalEnfants}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Dettes initiales</div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{dettesInitiales.length}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Obligations</div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{obligationsCotisation.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'enfants':
        const calculateAge = (dateNaissance: Date | string | null | undefined): number | null => {
          if (!dateNaissance) return null;
          try {
            const birthDate = typeof dateNaissance === 'string' ? new Date(dateNaissance) : dateNaissance;
            if (isNaN(birthDate.getTime())) return null;
            return differenceInYears(new Date(), birthDate);
          } catch {
            return null;
          }
        };

        const handleEditEnfant = (enfant: any) => {
          setEditingEnfant(enfant);
          setEnfantFormData({
            prenom: enfant.prenom || '',
            dateNaissance: enfant.dateNaissance ? format(new Date(enfant.dateNaissance), 'yyyy-MM-dd') : '',
            age: enfant.age || calculateAge(enfant.dateNaissance) || undefined
          });
          setShowEditEnfantDialog(true);
        };

        const handleSaveEnfant = async () => {
          if (!enfantFormData.prenom.trim()) {
            toast.error("Le prénom est requis");
            return;
          }

          try {
            const enfantsData = [...enfants];
            if (editingEnfant) {
              // Mettre à jour l'enfant existant
              const index = enfantsData.findIndex((e: any) => e.id === editingEnfant.id);
              if (index !== -1) {
                const dateNaissance = enfantFormData.dateNaissance ? new Date(enfantFormData.dateNaissance) : null;
                const age = enfantFormData.age || (dateNaissance ? calculateAge(dateNaissance) : null);
                enfantsData[index] = {
                  ...enfantsData[index],
                  prenom: enfantFormData.prenom,
                  dateNaissance: dateNaissance,
                  age: age
                };
              }
            } else {
              // Ajouter un nouvel enfant
              const dateNaissance = enfantFormData.dateNaissance ? new Date(enfantFormData.dateNaissance) : null;
              const age = enfantFormData.age || (dateNaissance ? calculateAge(dateNaissance) : null);
              enfantsData.push({
                id: `temp-${Date.now()}`,
                prenom: enfantFormData.prenom,
                dateNaissance: dateNaissance,
                age: age
              });
            }

            // Sauvegarder via updateUserData
            const result = await updateUserData(
              user || {},
              userProfile?.adherent || {},
              {},
              [],
              enfantsData
            );

            if (result.success) {
              toast.success(editingEnfant ? "Enfant mis à jour avec succès" : "Enfant ajouté avec succès");
              setEnfants(enfantsData);
              setShowEditEnfantDialog(false);
              setEditingEnfant(null);
              setEnfantFormData({ prenom: '', dateNaissance: '', age: undefined });
              // Recharger les données
              window.location.reload();
            } else {
              toast.error(result.message || "Erreur lors de la sauvegarde");
            }
          } catch (error) {
            console.error("Erreur:", error);
            toast.error("Erreur lors de la sauvegarde");
          }
        };

        const handleDeleteEnfant = async (enfantId: string) => {
          if (!confirm("Êtes-vous sûr de vouloir supprimer cet enfant ?")) {
            return;
          }

          try {
            const enfantsData = enfants.filter((e: any) => e.id !== enfantId);
            const result = await updateUserData(
              user || {},
              userProfile?.adherent || {},
              {},
              [],
              enfantsData
            );

            if (result.success) {
              toast.success("Enfant supprimé avec succès");
              setEnfants(enfantsData);
              // Recharger les données
              window.location.reload();
            } else {
              toast.error(result.message || "Erreur lors de la suppression");
            }
          } catch (error) {
            console.error("Erreur:", error);
            toast.error("Erreur lors de la suppression");
          }
        };

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Baby className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  Mes Enfants
                </h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
                  Gérez les informations de vos enfants
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditingEnfant(null);
                  setEnfantFormData({ prenom: '', dateNaissance: '', age: undefined });
                  setShowEditEnfantDialog(true);
                }}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un enfant
              </Button>
            </div>

            {enfants.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Baby className="h-16 w-16 text-gray-400 mb-4" />
                    <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-4">
                      Aucun enfant enregistré
                    </p>
                    <Button
                      onClick={() => {
                        setEditingEnfant(null);
                        setEnfantFormData({ prenom: '', dateNaissance: '', age: undefined });
                        setShowEditEnfantDialog(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter votre premier enfant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {enfants.map((enfant: any) => {
                  const age = enfant.age || (enfant.dateNaissance ? calculateAge(enfant.dateNaissance) : null);
                  return (
                    <Card key={enfant.id} className="!py-0 border-2 border-pink-200 dark:border-pink-800/50 hover:shadow-lg transition-shadow">
                      <CardHeader className="bg-gradient-to-r from-pink-500 to-pink-600 text-white py-3 sm:py-4">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                          <Baby className="h-4 w-4 sm:h-5 sm:w-5" />
                          {enfant.prenom}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6">
                        <div className="space-y-3">
                          {enfant.dateNaissance && (
                            <div>
                              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Date de naissance</div>
                              <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                {format(new Date(enfant.dateNaissance), "dd MMMM yyyy", { locale: fr })}
                              </div>
                            </div>
                          )}
                          {age !== null && (
                            <div>
                              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Âge</div>
                              <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                {age} an{age > 1 ? 's' : ''}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditEnfant(enfant)}
                              className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
                            >
                              <Edit2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              Modifier
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteEnfant(enfant.id)}
                              className="flex-1 text-xs sm:text-sm h-8 sm:h-9 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Dialog pour ajouter/modifier un enfant */}
            <Dialog open={showEditEnfantDialog} onOpenChange={setShowEditEnfantDialog}>
              <DialogContent className="w-[95vw] sm:w-full max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Baby className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    {editingEnfant ? 'Modifier un enfant' : 'Ajouter un enfant'}
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    {editingEnfant ? 'Modifiez les informations de l\'enfant' : 'Renseignez les informations de l\'enfant'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="enfant-prenom" className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Prénom *
                    </Label>
                    <Input
                      id="enfant-prenom"
                      value={enfantFormData.prenom}
                      onChange={(e) => setEnfantFormData({ ...enfantFormData, prenom: e.target.value })}
                      placeholder="Prénom de l'enfant"
                      className="mt-1.5 text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="enfant-date" className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Date de naissance
                    </Label>
                    <Input
                      id="enfant-date"
                      type="date"
                      value={enfantFormData.dateNaissance}
                      onChange={(e) => {
                        const date = e.target.value;
                        const age = date ? calculateAge(new Date(date)) : undefined;
                        setEnfantFormData({ ...enfantFormData, dateNaissance: date, age });
                      }}
                      className="mt-1.5 text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div>
                    <Label htmlFor="enfant-age" className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Âge (calculé automatiquement si date fournie)
                    </Label>
                    <Input
                      id="enfant-age"
                      type="number"
                      min="0"
                      value={enfantFormData.age || ""}
                      onChange={(e) => setEnfantFormData({ ...enfantFormData, age: parseInt(e.target.value) || undefined })}
                      placeholder="Âge"
                      className="mt-1.5 text-sm h-9 sm:h-10"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowEditEnfantDialog(false);
                        setEditingEnfant(null);
                        setEnfantFormData({ prenom: '', dateNaissance: '', age: undefined });
                      }}
                      className="text-sm h-9 sm:h-10"
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleSaveEnfant}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10"
                    >
                      {editingEnfant ? 'Enregistrer' : 'Ajouter'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );

      case 'passeport':
        return (
          <div className="space-y-3">
            {/* En-tête de section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                  Mon Passeport Adhérent
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Droits et obligations de l'adhérent</p>
              </div>
              <Button 
                onClick={async () => {
                  try {
                    const result = await downloadPasseportPDF();
                    if (result.success && result.pdfBuffer) {
                      const blob = new Blob([result.pdfBuffer], { type: 'application/pdf' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `passeport-amaki-${result.numeroPasseport || 'adhérent'}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                      toast.success("Passeport téléchargé avec succès");
                    } else {
                      toast.error(result.error || "Erreur lors du téléchargement");
                    }
                  } catch (error) {
                    console.error("Erreur:", error);
                    toast.error("Erreur lors du téléchargement du passeport");
                  }
                }}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger le passeport PDF
              </Button>
            </div>

            {/* Droits de l'adhérent */}
            <Card className="!py-0 border-2 border-green-200 dark:border-green-800 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30">
              <CardHeader className="py-3 sm:py-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 border-b-2 border-green-200 dark:border-green-800">
                <CardTitle className="text-base sm:text-lg text-green-900 dark:text-green-100 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                  Droits de l'Adhérent
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-2">
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-0.5">Droit de vote</h4>
                      <p className="text-xs text-green-800 dark:text-green-200">
                        Participer aux élections et votes de l'association lors des assemblées générales et consultations.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-0.5">Droit de candidature</h4>
                      <p className="text-xs text-green-800 dark:text-green-200">
                        Se porter candidat aux différents postes électifs de l'association selon les conditions établies.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-0.5">Droit de participation</h4>
                      <p className="text-xs text-green-800 dark:text-green-200">
                        Participer à toutes les activités, événements et réunions organisés par l'association.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-0.5">Droit d'expression</h4>
                      <p className="text-xs text-green-800 dark:text-green-200">
                        Proposer des idées, faire des suggestions et exprimer son opinion lors des assemblées et consultations.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-0.5">Droit à l'information</h4>
                      <p className="text-xs text-green-800 dark:text-green-200">
                        Recevoir toutes les informations concernant les activités, décisions et projets de l'association.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-0.5">Droit aux assistances</h4>
                      <p className="text-xs text-green-800 dark:text-green-200">
                        Bénéficier des assistances prévues par l'association (naissance, mariage, décès, anniversaire de salle, etc.).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-green-200 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-0.5">Droit de consultation</h4>
                      <p className="text-xs text-green-800 dark:text-green-200">
                        Consulter les documents et comptes de l'association selon les modalités prévues par les statuts.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Obligations de l'adhérent */}
            <Card className="!py-0 border-2 border-orange-200 dark:border-orange-800 shadow-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30">
              <CardHeader className="py-3 sm:py-4 bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/50 dark:to-amber-900/50 border-b-2 border-orange-200 dark:border-orange-800">
                <CardTitle className="text-base sm:text-lg text-orange-900 dark:text-orange-100 flex items-center gap-2">
                  <Scale className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                  Obligations de l'Adhérent
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-2">
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-0.5">Paiement des cotisations</h4>
                      <p className="text-xs text-orange-800 dark:text-orange-200">
                        Payer régulièrement les cotisations mensuelles et les frais d'adhésion selon les modalités établies.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-0.5">Respect des statuts</h4>
                      <p className="text-xs text-orange-800 dark:text-orange-200">
                        Respecter les statuts, le règlement intérieur et les décisions prises par les instances de l'association.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-0.5">Participation active</h4>
                      <p className="text-xs text-orange-800 dark:text-orange-200">
                        Participer activement à la vie de l'association et contribuer à son développement.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-0.5">Respect des valeurs</h4>
                      <p className="text-xs text-orange-800 dark:text-orange-200">
                        Respecter les valeurs de l'association : Intégration, Respect et Solidarité.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-0.5">Mise à jour des informations</h4>
                      <p className="text-xs text-orange-800 dark:text-orange-200">
                        Maintenir à jour ses informations personnelles et notifier tout changement à l'association.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-0.5">Confidentialité</h4>
                      <p className="text-xs text-orange-800 dark:text-orange-200">
                        Respecter la confidentialité des informations et discussions internes à l'association.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2 bg-white/50 dark:bg-white/10 rounded-md border border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-0.5">Assiduité</h4>
                      <p className="text-xs text-orange-800 dark:text-orange-200">
                        Assister aux assemblées générales et réunions importantes de l'association dans la mesure du possible.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Règlement intérieur */}
            <Card className="!py-0 border-2 border-purple-200 dark:border-purple-800 shadow-lg bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/30 dark:to-violet-900/30">
              <CardHeader className="py-3 sm:py-4 bg-gradient-to-r from-purple-100 to-violet-100 dark:from-purple-900/50 dark:to-violet-900/50 border-b-2 border-purple-200 dark:border-purple-800">
                <CardTitle className="text-base sm:text-lg text-purple-900 dark:text-purple-100 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                  Règlement d'Ordre Intérieur
                </CardTitle>
                
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-3">
                {/* Article 1 */}
                <div className="p-3 bg-white/50 dark:bg-white/10 rounded-md border border-purple-200 dark:border-purple-800">
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Article 1 – Objet du règlement intérieur
                  </h4>
                  <p className="text-xs text-purple-800 dark:text-purple-200 leading-relaxed">
                    Le présent règlement intérieur a pour objet de préciser les règles de fonctionnement de l'association, conformément aux statuts. Il s'impose à tous les membres.
                  </p>
                </div>

                {/* Article 2 */}
                <div className="p-3 bg-white/50 dark:bg-white/10 rounded-md border border-purple-200 dark:border-purple-800">
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Article 2 – Cotisation
                  </h4>
                  <div className="space-y-2 text-xs text-purple-800 dark:text-purple-200">
                    <p className="leading-relaxed">
                      <strong>1.</strong> Le montant de la cotisation est fixé à <strong>15 € par mois</strong>, soit <strong>180 € par an</strong>.
                    </p>
                    <p className="leading-relaxed">
                      <strong>2.</strong> La cotisation est due par tous les membres actifs.
                    </p>
                    <p className="leading-relaxed">
                      <strong>3.</strong> Tout retard de cotisation supérieur ou égal à trois (3) mois entraîne :
                    </p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>la perte du droit d'assistance financière de l'association ;</li>
                      <li>la suspension du droit de vote jusqu'à régularisation.</li>
                    </ul>
                  </div>
                </div>

                {/* Article 3 */}
                <div className="p-3 bg-white/50 dark:bg-white/10 rounded-md border border-purple-200 dark:border-purple-800">
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Article 3 – Perte de la qualité de membre
                  </h4>
                  <div className="space-y-2 text-xs text-purple-800 dark:text-purple-200">
                    <p className="leading-relaxed mb-2">
                      La qualité de membre se perd automatiquement dans les cas suivants :
                    </p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>Retard de cotisation de trois (3) mois ou plus non régularisé malgré relance ;</li>
                      <li>Absence prolongée et injustifiée aux activités de l'association ;</li>
                      <li>Indiscipline grave ou faute portant préjudice moral ou matériel à l'association.</li>
                    </ul>
                    <p className="leading-relaxed mt-2">
                      La radiation est prononcée conformément aux statuts, après audition éventuelle du membre concerné.
                    </p>
                  </div>
                </div>

                {/* Article 4 */}
                <div className="p-3 bg-white/50 dark:bg-white/10 rounded-md border border-purple-200 dark:border-purple-800">
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Article 4 – Assistance financière et solidarité
                  </h4>
                  <div className="space-y-2 text-xs text-purple-800 dark:text-purple-200">
                    <p className="leading-relaxed">
                      L'association peut accorder une aide financière ou matérielle aux membres en difficulté. Toutefois, cette aide est réservée exclusivement aux membres :
                    </p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>À jour de leurs cotisations ;</li>
                      <li>Ayant une participation active et régulière à la vie de l'association ;</li>
                      <li>Respectueux du règlement intérieur et du code de conduite.</li>
                    </ul>
                    <p className="leading-relaxed mt-2 font-semibold">
                      Aucun membre en retard de cotisation de trois (3) mois ou plus ne pourra bénéficier d'une assistance.
                    </p>
                  </div>
                </div>

                {/* Article 5 */}
                <div className="p-3 bg-white/50 dark:bg-white/10 rounded-md border border-purple-200 dark:border-purple-800">
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Article 5 – Discipline et sanctions
                  </h4>
                  <div className="space-y-2 text-xs text-purple-800 dark:text-purple-200">
                    <p className="leading-relaxed">
                      <strong>1.</strong> Les membres doivent observer une attitude respectueuse vis-à-vis des autres membres et des organes dirigeants.
                    </p>
                    <p className="leading-relaxed">
                      <strong>2.</strong> Tout comportement indiscipliné, violent, diffamatoire ou portant atteinte à l'image de l'association est interdit.
                    </p>
                    <p className="leading-relaxed">
                      <strong>3.</strong> Les sanctions applicables sont :
                    </p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>Avertissement ;</li>
                      <li>Suspension temporaire ;</li>
                      <li>Exclusion définitive (radiation).</li>
                    </ul>
                  </div>
                </div>

                {/* Article 6 */}
                <div className="p-3 bg-white/50 dark:bg-white/10 rounded-md border border-purple-200 dark:border-purple-800">
                  <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Article 6 – Application et modification
                  </h4>
                  <p className="text-xs text-purple-800 dark:text-purple-200 leading-relaxed">
                    Le présent règlement intérieur entre en vigueur dès son adoption par l'Assemblée Générale. Il peut être modifié par décision de l'Assemblée Générale sur proposition du Conseil d'Administration.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Informations complémentaires */}
            <Card className="!py-0 border-2 border-blue-200 dark:border-blue-800 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30">
              <CardHeader className="py-3 sm:py-4 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 border-b-2 border-blue-200 dark:border-blue-800">
                <CardTitle className="text-base sm:text-lg text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <Info className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                  Informations Complémentaires
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 space-y-2">
                <div className="space-y-2">
                  <div className="p-2 bg-white/50 dark:bg-white/10 rounded-md border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Valeurs de l'Association</h4>
                    <p className="text-xs text-blue-800 dark:text-blue-200 mb-1">
                      <strong>Intégration</strong> - Favoriser l'intégration des membres dans la société française tout en préservant leurs racines culturelles.
                    </p>
                    <p className="text-xs text-blue-800 dark:text-blue-200 mb-1">
                      <strong>Respect</strong> - Promouvoir le respect mutuel, la tolérance et la diversité culturelle.
                    </p>
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <strong>Solidarité</strong> - Développer l'entraide et la solidarité entre les membres de l'association.
                    </p>
                  </div>

                  <div className="p-2 bg-white/50 dark:bg-white/10 rounded-md border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Contact</h4>
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      Pour toute question concernant vos droits et obligations, n'hésitez pas à contacter le secrétariat de l'association.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                Préférences de Notifications
              </h2>
              <p className="text-gray-600 dark:text-gray-300">Configurez comment et quand vous recevez les notifications</p>
            </div>
            <NotificationPreferences
              onSave={async (preferences) => {
                // Pour l'instant, on sauvegarde juste en mémoire
                // Plus tard, on pourra sauvegarder en base de données
                toast.success("Préférences sauvegardées (en mémoire)");
              }}
            />
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Paramètres du Compte</h2>
              <p className="text-gray-600 dark:text-gray-300">Gérez vos préférences et paramètres</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Informations du Compte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Statut</span>
                    <Badge className={getStatusColor(userStatus)}>
                      {userStatus}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Rôle</span>
                    <Badge className={getRoleColor(userRole)}>
                      {userRole}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">ID Utilisateur</span>
                    <span className="text-sm font-medium font-mono">
                      {user.id?.slice(0, 8) || "Non disponible"}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Image de profil</span>
                    <span className="text-sm font-medium">
                      {(displayUser as any)?.image ? "Définie" : "Non définie"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-600" />
                    Actions Rapides
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!isViewAsMode && (
                  <>
                  <Link href="/user/update" className="block">
                    <Button className="w-full" variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier le profil
                    </Button>
                  </Link>
                  <ChangePasswordDialog
                    trigger={
                      <Button className="w-full" variant="outline">
                        <Shield className="h-4 w-4 mr-2" />
                        Changer le mot de passe
                      </Button>
                    }
                  />
                  <Button className="w-full" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Préférences
                  </Button>
                  </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'idees':
        const handleCreateIdee = async () => {
          if (!ideeFormData.titre.trim() || !ideeFormData.description.trim()) {
            toast.error("Veuillez remplir tous les champs");
            return;
          }

          try {
            setIdeesLoading(true);
            const formData = new FormData();
            formData.append("titre", ideeFormData.titre);
            formData.append("description", ideeFormData.description);

            const result = await createIdee(formData);
            if (result.success) {
              toast.success(result.message || "Idée créée avec succès");
              setIdeeFormData({ titre: '', description: '' });
              setShowCreateIdeeDialog(false);
              // Recharger les idées
              if (user?.id) {
                const ideesResult = await getIdeesByUser(user.id);
                if (ideesResult.success && ideesResult.data) {
                  setIdees(ideesResult.data || []);
                }
                // Recharger aussi toutes les idées validées
                const allIdeesResult = await getAllIdees();
                if (allIdeesResult.success && allIdeesResult.data) {
                  setAllIdees(allIdeesResult.data || []);
                }
              }
            } else {
              toast.error(result.error || "Erreur lors de la création de l'idée");
            }
          } catch (error) {
            console.error("Erreur lors de la création de l'idée:", error);
            toast.error("Erreur lors de la création de l'idée");
          } finally {
            setIdeesLoading(false);
          }
        };

        const handleEditIdee = async () => {
          if (!ideeFormData.titre.trim() || !ideeFormData.description.trim()) {
            toast.error("Veuillez remplir tous les champs");
            return;
          }

          if (!editingIdee) return;

          try {
            setIdeesLoading(true);
            const formData = new FormData();
            formData.append("id", editingIdee.id);
            formData.append("titre", ideeFormData.titre);
            formData.append("description", ideeFormData.description);

            const result = await updateIdee(formData);
            if (result.success) {
              toast.success(result.message || "Idée mise à jour avec succès");
              setIdeeFormData({ titre: '', description: '' });
              setEditingIdee(null);
              setShowEditIdeeDialog(false);
              // Recharger les idées
              if (user?.id) {
                const ideesResult = await getIdeesByUser(user.id);
                if (ideesResult.success && ideesResult.data) {
                  setIdees(ideesResult.data || []);
                }
                // Recharger aussi toutes les idées validées
                const allIdeesResult = await getAllIdees();
                if (allIdeesResult.success && allIdeesResult.data) {
                  setAllIdees(allIdeesResult.data || []);
                }
              }
            } else {
              toast.error(result.error || "Erreur lors de la mise à jour de l'idée");
            }
          } catch (error) {
            console.error("Erreur lors de la mise à jour de l'idée:", error);
            toast.error("Erreur lors de la mise à jour de l'idée");
          } finally {
            setIdeesLoading(false);
          }
        };

        const handleDeleteIdee = async (ideeId: string) => {
          if (!confirm("Êtes-vous sûr de vouloir supprimer cette idée ?")) {
            return;
          }

          try {
            setIdeesLoading(true);
            const result = await deleteIdee(ideeId);
            if (result.success) {
              toast.success(result.message || "Idée supprimée avec succès");
              // Recharger les idées
              if (user?.id) {
                const ideesResult = await getIdeesByUser(user.id);
                if (ideesResult.success && ideesResult.data) {
                  setIdees(ideesResult.data || []);
                }
                // Recharger aussi toutes les idées validées
                const allIdeesResult = await getAllIdees();
                if (allIdeesResult.success && allIdeesResult.data) {
                  setAllIdees(allIdeesResult.data || []);
                }
              }
            } else {
              toast.error(result.error || "Erreur lors de la suppression de l'idée");
            }
          } catch (error) {
            console.error("Erreur lors de la suppression de l'idée:", error);
            toast.error("Erreur lors de la suppression de l'idée");
          } finally {
            setIdeesLoading(false);
          }
        };

        const getStatutBadge = (statut: StatutIdee) => {
          switch (statut) {
            case StatutIdee.Validee:
              return <Badge className="bg-green-500">Validée</Badge>;
            case StatutIdee.EnAttente:
              return <Badge className="bg-yellow-500">En attente</Badge>;
            case StatutIdee.Rejetee:
              return <Badge className="bg-red-500">Rejetée</Badge>;
            case StatutIdee.Bloquee:
              return <Badge className="bg-red-600">Bloquée</Badge>;
            default:
              return null;
          }
        };

        const handleCommentSubmit = async (ideeId: string) => {
          if (!commentContent.trim()) {
            toast.error("Veuillez saisir un commentaire");
            return;
          }

          try {
            setCommentLoading(true);
            const formData = new FormData();
            formData.append("ideeId", ideeId);
            formData.append("contenu", commentContent);

            const result = await createCommentaire(formData);
            if (result.success) {
              toast.success("Commentaire ajouté avec succès");
              setCommentContent("");
              setShowCommentForm(null);
              // Recharger toutes les idées
              const allIdeesResult = await getAllIdees();
              if (allIdeesResult.success && allIdeesResult.data) {
                setAllIdees(allIdeesResult.data || []);
              }
            } else {
              toast.error(result.error || "Erreur lors de l'ajout du commentaire");
            }
          } catch (error) {
            console.error("Erreur lors de l'ajout du commentaire:", error);
            toast.error("Erreur lors de l'ajout du commentaire");
          } finally {
            setCommentLoading(false);
          }
        };

        const handleToggleApprobation = async (ideeId: string) => {
          try {
            const result = await toggleApprobation(ideeId);
            if (result.success) {
              // Recharger toutes les idées
              const allIdeesResult = await getAllIdees();
              if (allIdeesResult.success && allIdeesResult.data) {
                setAllIdees(allIdeesResult.data || []);
              }
            } else {
              toast.error(result.error || "Erreur lors de l'approbation");
            }
          } catch (error) {
            console.error("Erreur lors de l'approbation:", error);
            toast.error("Erreur lors de l'approbation");
          }
        };

        const toggleExpandIdee = (ideeId: string) => {
          const newExpanded = new Set(expandedIdees);
          if (newExpanded.has(ideeId)) {
            newExpanded.delete(ideeId);
          } else {
            newExpanded.add(ideeId);
          }
          setExpandedIdees(newExpanded);
        };

        const hasUserApprobation = (idee: any) => {
          if (!user?.id) return false;
          return idee.Approbations?.some((app: any) => app.Adherent?.User?.id === user.id) || false;
        };

        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Idées</h2>
                <p className="text-gray-600 dark:text-gray-300">Gérez vos idées et découvrez celles des autres adhérents</p>
              </div>
              <Dialog open={showCreateIdeeDialog} onOpenChange={setShowCreateIdeeDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Proposer une idée
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Proposer une nouvelle idée</DialogTitle>
                    <DialogDescription>
                      Partagez votre idée avec l'association. Elle sera examinée par l'administration.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="titre">Titre *</Label>
                      <Input
                        id="titre"
                        value={ideeFormData.titre}
                        onChange={(e) => setIdeeFormData({ ...ideeFormData, titre: e.target.value })}
                        placeholder="Titre de votre idée"
                        maxLength={255}
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={ideeFormData.description}
                        onChange={(e) => setIdeeFormData({ ...ideeFormData, description: e.target.value })}
                        placeholder="Décrivez votre idée en détail..."
                        rows={6}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => {
                        setShowCreateIdeeDialog(false);
                        setIdeeFormData({ titre: '', description: '' });
                      }}>
                        Annuler
                      </Button>
                      <Button onClick={handleCreateIdee} disabled={ideesLoading} className="bg-blue-600 hover:bg-blue-700">
                        {ideesLoading ? "Création..." : "Créer l'idée"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Tabs value={selectedIdeeTab} onValueChange={(value) => setSelectedIdeeTab(value as 'mes-idees' | 'toutes-idees')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="mes-idees" className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Mes Idées ({idees.length})
                </TabsTrigger>
                <TabsTrigger value="toutes-idees" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Toutes les Idées ({allIdees.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="mes-idees" className="space-y-4">
                {ideesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : idees.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Lightbulb className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300 text-lg mb-4">
                        Vous n'avez pas encore soumis d'idée
                      </p>
                      <Button onClick={() => setShowCreateIdeeDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-4 w-4 mr-2" />
                        Proposer une idée
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {idees.map((idee) => (
                      <Card key={idee.id} className="shadow-md">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">{idee.titre}</CardTitle>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {format(new Date(idee.dateCreation), "d MMMM yyyy à HH:mm", { locale: fr })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <MessageSquare className="h-4 w-4" />
                                  <span>{idee.nombreCommentaires} commentaire{idee.nombreCommentaires !== 1 ? "s" : ""}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <ThumbsUp className="h-4 w-4" />
                                  <span>{idee.nombreApprobations} approbation{idee.nombreApprobations !== 1 ? "s" : ""}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatutBadge(idee.statut)}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
                            {idee.description}
                          </p>
                          {idee.raisonRejet && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                              <p className="text-sm text-red-700 dark:text-red-300">
                                <strong>Raison du rejet/blocage :</strong> {idee.raisonRejet}
                              </p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            {idee.statut === StatutIdee.EnAttente && !idee.estLue && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingIdee(idee);
                                    setIdeeFormData({ titre: idee.titre, description: idee.description });
                                    setShowEditIdeeDialog(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Modifier
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteIdee(idee.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </Button>
                              </>
                            )}
                            {idee.estLue && (
                              <p className="text-sm text-gray-500 italic">
                                Cette idée ne peut plus être modifiée ou supprimée car elle a déjà été lue. Contactez l'administration si nécessaire.
                              </p>
                            )}
                            <Link href="/idees" className="ml-auto">
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                Voir sur le site
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="toutes-idees" className="space-y-4">
                {allIdeesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : allIdees.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Lightbulb className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Aucune idée validée pour le moment
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {allIdees.map((idee) => {
                      const isExpanded = expandedIdees.has(idee.id);
                      const hasApprobation = hasUserApprobation(idee);
                      const auteurName = `${idee.Adherent?.firstname || ''} ${idee.Adherent?.lastname || ''}`.trim() || 'Auteur inconnu';
                      
                      return (
                        <Card key={idee.id} className="shadow-md hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-3 mb-3">
                                  <Avatar className="h-10 w-10 flex-shrink-0">
                                    <AvatarImage src={idee.Adherent?.User?.image || undefined} alt={auteurName} />
                                    <AvatarFallback className="bg-blue-100 text-blue-600">
                                      {auteurName.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <CardTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1">{idee.titre}</CardTitle>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                      Par {auteurName}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500 flex-wrap">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span>
                                          {format(new Date(idee.dateCreation), "d MMMM yyyy à HH:mm", { locale: fr })}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        <span>{idee.Commentaires?.length || 0} commentaire{(idee.Commentaires?.length || 0) !== 1 ? "s" : ""}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <ThumbsUp className="h-3.5 w-3.5" />
                                        <span>{idee.Approbations?.length || 0} approbation{(idee.Approbations?.length || 0) !== 1 ? "s" : ""}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className={`text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-3' : ''}`}>
                              {idee.description}
                            </p>
                            
                            {!isExpanded && idee.description.length > 150 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpandIdee(idee.id)}
                                className="text-blue-600 hover:text-blue-700 mb-4"
                              >
                                Voir plus
                              </Button>
                            )}

                            {isExpanded && (
                              <>
                                {/* Commentaires */}
                                {idee.Commentaires && idee.Commentaires.length > 0 && (
                                  <div className="mt-4 space-y-3 border-t pt-4">
                                    <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
                                      Commentaires ({idee.Commentaires.length})
                                    </h4>
                                    {idee.Commentaires.map((comment: any) => (
                                      <div key={comment.id} className="flex gap-3">
                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                          <AvatarImage src={comment.Adherent?.User?.image || undefined} alt={`${comment.Adherent?.firstname || ''} ${comment.Adherent?.lastname || ''}`} />
                                          <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
                                            {`${comment.Adherent?.firstname || ''} ${comment.Adherent?.lastname || ''}`.charAt(0).toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                              {`${comment.Adherent?.firstname || ''} ${comment.Adherent?.lastname || ''}`.trim() || 'Anonyme'}
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                              {comment.contenu}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                              {format(new Date(comment.createdAt), "d MMM yyyy à HH:mm", { locale: fr })}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Formulaire de commentaire */}
                                {showCommentForm === idee.id ? (
                                  <div className="mt-4 space-y-2 border-t pt-4">
                                    <Label htmlFor={`comment-${idee.id}`} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                      Ajouter un commentaire
                                    </Label>
                                    <Textarea
                                      id={`comment-${idee.id}`}
                                      value={commentContent}
                                      onChange={(e) => setCommentContent(e.target.value)}
                                      placeholder="Votre commentaire..."
                                      rows={3}
                                      className="resize-none"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setShowCommentForm(null);
                                          setCommentContent("");
                                        }}
                                      >
                                        Annuler
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => handleCommentSubmit(idee.id)}
                                        disabled={commentLoading}
                                        className="bg-blue-600 hover:bg-blue-700"
                                      >
                                        {commentLoading ? "Envoi..." : "Commenter"}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowCommentForm(idee.id)}
                                    className="mt-4"
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Commenter
                                  </Button>
                                )}

                                {isExpanded && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpandIdee(idee.id)}
                                    className="text-blue-600 hover:text-blue-700 mt-2"
                                  >
                                    Voir moins
                                  </Button>
                                )}
                              </>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                              <Button
                                variant={hasApprobation ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleToggleApprobation(idee.id)}
                                className={hasApprobation ? "bg-blue-600 hover:bg-blue-700" : ""}
                              >
                                <ThumbsUp className={`h-4 w-4 mr-2 ${hasApprobation ? "fill-current" : ""}`} />
                                {hasApprobation ? "Approuvé" : "Approuver"}
                              </Button>
                              {!isExpanded && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleExpandIdee(idee.id)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Voir les détails
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Dialog d'édition */}
            <Dialog open={showEditIdeeDialog} onOpenChange={setShowEditIdeeDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Modifier l'idée</DialogTitle>
                  <DialogDescription>
                    Modifiez votre idée. Notez que si elle a déjà été lue, vous devrez contacter l'administration.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-titre">Titre *</Label>
                    <Input
                      id="edit-titre"
                      value={ideeFormData.titre}
                      onChange={(e) => setIdeeFormData({ ...ideeFormData, titre: e.target.value })}
                      placeholder="Titre de votre idée"
                      maxLength={255}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-description">Description *</Label>
                    <Textarea
                      id="edit-description"
                      value={ideeFormData.description}
                      onChange={(e) => setIdeeFormData({ ...ideeFormData, description: e.target.value })}
                      placeholder="Décrivez votre idée en détail..."
                      rows={6}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => {
                      setShowEditIdeeDialog(false);
                      setEditingIdee(null);
                      setIdeeFormData({ titre: '', description: '' });
                    }}>
                      Annuler
                    </Button>
                    <Button onClick={handleEditIdee} disabled={ideesLoading} className="bg-blue-600 hover:bg-blue-700">
                      {ideesLoading ? "Mise à jour..." : "Mettre à jour"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );

      case 'taches':
        // Vérifier si l'utilisateur a un profil adhérent
        if (effectiveLoading) {
          return (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          );
        }
        
        // Vérifier si l'utilisateur est un adhérent
        const hasAdherentProfile = effectiveProfile?.adherent && effectiveProfile.adherent.id;
        const userRole = user?.role || userProfile?.role;
        const isAdmin = userRole === 'ADMIN';
        
        // Si pas de profil adhérent et pas admin, afficher un message
        if (!hasAdherentProfile) {
          if (isAdmin) {
            return (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        En tant qu'administrateur, vous pouvez gérer les projets depuis la section Admin.
                      </p>
                      <Link href="/admin/projets">
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                          <FileText className="h-4 w-4 mr-2" />
                          Gérer les projets
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          }
          
          return (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Vous devez être un adhérent pour voir vos tâches assignées.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        }
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Mes Tâches</h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">Voir et suivre mes tâches assignées</p>
              </div>
              <Link href="/user/taches">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <FileText className="h-4 w-4 mr-2" />
                  Voir toutes mes tâches
                </Button>
              </Link>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Pour voir vos tâches en détail et les commenter, visitez la page dédiée.
                  </p>
                  <Link href="/user/taches">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <FileText className="h-4 w-4 mr-2" />
                      Accéder à mes tâches
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'projets':
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Projets Amaki</h2>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">Consulter les projets de l&apos;association en lecture seule</p>
              </div>
              <Link href="/user/projets">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Voir les projets
                </Button>
              </Link>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8">
                  <FolderKanban className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Consultez la liste des projets Amaki et leurs détails (description, tâches, adhérents affectés).
                  </p>
                  <Link href="/user/projets">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <FolderKanban className="h-4 w-4 mr-2" />
                      Accéder aux projets Amaki
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />

      {/* Bannière "Vue comme l'adhérent" (admin) */}
      {isViewAsMode && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-4 bg-amber-500 text-amber-950 px-4 py-2 shadow-md">
          <span className="text-sm font-medium">
            Vous consultez le profil de <strong>{displayUser?.name || (effectiveProfile?.adherent as any)?.firstname + " " + (effectiveProfile?.adherent as any)?.lastname || "cet adhérent"}</strong> en tant qu&apos;administrateur (lecture seule).
          </span>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/90 border-amber-700 text-amber-900 hover:bg-white shrink-0"
            onClick={() => router.push("/user/profile")}
          >
            Quitter la vue adhérent
          </Button>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative py-3 sm:py-4 md:py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 md:gap-4">
            <div className="relative flex-shrink-0">
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 border-4 border-white shadow-2xl">
                <AvatarImage 
                  src={effectiveProfile?.image || (user as any)?.image || ""} 
                  alt={displayUser?.name || "Utilisateur"}
                  className="object-cover"
                />
                <AvatarFallback className="text-2xl sm:text-3xl md:text-4xl bg-white text-gray-800">
                  {(displayUser?.name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-0.5 sm:mb-1">
                {displayUser?.name || "Utilisateur"}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-blue-100 mb-1 sm:mb-2 truncate">{displayUser?.email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 sm:gap-2">
                <Badge className={`${getStatusColor((displayUser as any)?.status || userStatus)} text-xs`}>
                  <CheckCircle className="h-3 w-3 mr-0.5" />
                  {(displayUser as any)?.status || userStatus}
                </Badge>
                <Badge className={`${getRoleColor((displayUser as any)?.role || userRole)} text-xs`}>
                  <Shield className="h-3 w-3 mr-0.5" />
                  {(displayUser as any)?.role || userRole}
                </Badge>
                {effectiveProfile?.adherent?.PosteTemplate && (
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                    <Award className="h-3 w-3 mr-0.5" />
                    {effectiveProfile.adherent.PosteTemplate.libelle}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
              {effectiveProfile?.adherent?.numeroPasseport && (displayUser as any)?.status === "Actif" && (
                <Button 
                  onClick={handleDownloadPasseport}
                  className="bg-white text-blue-600 hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 font-medium shadow-sm"
                  title={`Télécharger le passeport ${effectiveProfile.adherent.numeroPasseport}`}
                >
                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Passeport</span>
                </Button>
              )}
              {!isViewAsMode && (
                <>
                  <Link href="/user/update">
                    <Button className="bg-white text-blue-600 hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 font-medium shadow-sm">
                      <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden sm:inline">Modifier</span>
                    </Button>
                  </Link>
                      <ChangePasswordDialog
                    trigger={
                      <Button className="bg-white/90 text-blue-600 hover:bg-white dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 font-medium shadow-sm">
                        <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline ml-1">Paramètres</span>
                      </Button>
                    }
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Contenu principal avec menu latéral */}
      <section className="py-8 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-8">
            
            {/* Menu latéral - Desktop */}
            <div className="hidden lg:block lg:col-span-1">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle className="text-lg">Mon Compte</CardTitle>
                  <CardDescription>
                    Gérez votre profil et vos activités
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <nav className="space-y-1">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id;
                      
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveSection(item.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-2 border-blue-600'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <div className="flex-1">
                            <div className="font-medium">{item.label}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.description}
                            </div>
                          </div>
                          {isActive ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </CardContent>
              </Card>
            </div>

            {/* Menu horizontal scrollable - Mobile */}
            <div className="lg:hidden -mx-4 sm:mx-0">
              <div className="overflow-x-auto px-4 sm:px-0 pb-2">
                <div className="flex gap-2 min-w-max">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Contenu principal */}
            <div className="lg:col-span-3">
              {renderSectionContent()}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Chargement...</p>
        </div>
      </div>
    }>
      <UserProfilePageContent />
    </Suspense>
  );
}