"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
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
  BookOpen,
  Scale,
  Bell
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUserProfile } from "@/hooks/use-user-profile";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { updateUserData, getUserCandidatures, getUserVotes, getAllCandidatesForProfile } from "@/actions/user";
import { downloadPasseportPDF } from "@/actions/passeport";
import { differenceInYears, differenceInMonths } from "date-fns";
import { toast } from "sonner";
import { FinancialTables } from "@/components/financial/financial-tables";
import { NotificationPreferences } from "@/components/user/NotificationPreferences";
import { getIdeesByUser, getAllIdees, createIdee, updateIdee, deleteIdee, createCommentaire, toggleApprobation } from "@/actions/idees";
import { getDocuments, deleteDocument } from "@/actions/documents";
import { getUserBadges } from "@/actions/badges";
import { StatutIdee, TypeDocument } from "@prisma/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
type MenuSection = 'profile' | 'statistiques' | 'cotisations' | 'candidatures' | 'votes' | 'candidates' | 'idees' | 'documents' | 'badges' | 'enfants' | 'passeport' | 'notifications' | 'settings';

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
  const [sorting, setSorting] = useState<SortingState>([{ id: 'annee', desc: true }]);

  const columnHelper = createColumnHelper<DetteInitiale>();

  const columns = useMemo<ColumnDef<DetteInitiale>[]>(
    () => [
      columnHelper.accessor('annee', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-7 px-2 font-semibold text-xs text-red-900 dark:text-red-300"
          >
            Année
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 justify-center">
            <Calendar className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="font-medium">{row.getValue('annee')}</span>
          </div>
        ),
      }),
      columnHelper.accessor('montant', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-7 px-2 font-semibold text-xs text-gray-900 dark:text-gray-300"
          >
            Montant total
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-gray-900 dark:text-white">
            {parseFloat(row.getValue('montant')).toFixed(2).replace('.', ',')} €
          </span>
        ),
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
      columnHelper.accessor('description', {
        header: 'Description',
        cell: ({ row }) => (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {row.getValue('description') || '-'}
          </span>
        ),
      }),
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
    ],
    []
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
  });

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle px-4 sm:px-0">
        <Table className="min-w-[640px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-red-50 dark:bg-red-900/20">
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
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-center text-xs px-2 py-1.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
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
              table.getRowModel().rows.map((row) => (
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
              ))
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
  cotisationMensuelleId?: string;
  assistanceId?: string;
}

function CotisationsMoisTable({ cotisations }: { cotisations: CotisationMois[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'type', desc: false }]);

  const columnHelper = createColumnHelper<CotisationMois>();

  // Calculer le total du mois
  const totalMois = useMemo(() => {
    return cotisations.reduce((sum, cot) => sum + cot.montant, 0);
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
          const isPaye = montantRestant === 0 || statut === 'Paye' || statut === 'Valide';
          
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
          let paymentUrl = '/paiement?';
          if (row.original.isCotisationMensuelle && row.original.cotisationMensuelleId) {
            paymentUrl += `type=cotisation-mensuelle&id=${row.original.cotisationMensuelleId}`;
          } else if (row.original.isAssistance) {
            paymentUrl += `type=assistance&id=${row.original.assistanceId}`;
          } else {
            paymentUrl += `type=cotisation&id=${row.original.id}`;
          }
          
          return (
            <a href={paymentUrl}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-7 sm:h-8 text-xs px-2 sm:px-3">
                <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Payer</span>
                <span className="sm:hidden">€</span>
              </Button>
            </a>
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
        <div className="flex justify-end items-center gap-3 px-4 sm:px-0 pt-2 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">Total du mois :</span>
          <span className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
            {totalMois.toFixed(2).replace('.', ',')} €
          </span>
        </div>
      )}
    </div>
  );
}

export default function UserProfilePage() {
  const user = useCurrentUser();
  const { userProfile, loading: profileLoading, error: profileError } = useUserProfile();
  const [currentImage, setCurrentImage] = useState(user?.image || "");
  const [activeSection, setActiveSection] = useState<MenuSection>('profile');
  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [obligationsCotisation, setObligationsCotisation] = useState<any[]>([]);
  const [dettesInitiales, setDettesInitiales] = useState<any[]>([]);
  const [cotisationsMois, setCotisationsMois] = useState<any[]>([]);
  const [cotisationMoisProchain, setCotisationMoisProchain] = useState<any>(null);
  const [showCotisationMoisProchain, setShowCotisationMoisProchain] = useState(false);
  const [avoirs, setAvoirs] = useState<any[]>([]);
  const [historiqueCotisations, setHistoriqueCotisations] = useState<any[]>([]);
  const [showHistoriqueCotisations, setShowHistoriqueCotisations] = useState(false);
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
  const [badges, setBadges] = useState<any[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [enfants, setEnfants] = useState<any[]>([]);
  const [showEditEnfantDialog, setShowEditEnfantDialog] = useState(false);
  const [editingEnfant, setEditingEnfant] = useState<any>(null);
  const [enfantFormData, setEnfantFormData] = useState({ prenom: '', dateNaissance: '', age: undefined as number | undefined });

  // Synchroniser l'image avec les données utilisateur
  useEffect(() => {
    if (userProfile?.image) {
      setCurrentImage(userProfile.image);
    } else if (user?.image) {
      setCurrentImage(user.image);
    }
  }, [userProfile?.image, user?.image]);

  // Charger les données selon la section active
  useEffect(() => {
    const loadSectionData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        switch (activeSection) {
          case 'cotisations':
            // Charger les cotisations, obligations, dettes initiales et cotisations du mois depuis le profil utilisateur
            // SAUF si l'utilisateur est admin (l'admin ne cotise ni ne bénéficie d'assistances)
            const isAdmin = user?.role === 'Admin';
            
            if (userProfile?.adherent && !isAdmin) {
              setCotisations((userProfile.adherent as any).Cotisations || []);
              setObligationsCotisation((userProfile.adherent as any).ObligationsCotisation || []);
              setDettesInitiales((userProfile.adherent as any).DettesInitiales || []);
              setAvoirs((userProfile.adherent as any).Avoirs || []);
              
              // Construire la liste des cotisations du mois : forfait mensuel + assistances du mois (séparés)
              const cotisationsMensuelles = ((userProfile.adherent as any).CotisationsMensuelles || []);
              const assistances = ((userProfile.adherent as any).Assistances || []);
              
              // Filtrer les cotisations mensuelles du mois en cours
              const moisCourant = new Date().getMonth() + 1;
              const anneeCourante = new Date().getFullYear();
              const cotisationMensuelleCourante = cotisationsMensuelles.find((cm: any) => 
                cm.mois === moisCourant && cm.annee === anneeCourante
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
                const typeForfait = (userProfile as any)?.typeForfait;
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
              const adherentId = (userProfile.adherent as any)?.id;
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
              const toutesCotisationsMensuelles = ((userProfile.adherent as any).CotisationsMensuelles || []);
              setHistoriqueCotisations(toutesCotisationsMensuelles);
              
              // Récupérer la cotisation du mois prochain
              if ((userProfile as any).cotisationMoisProchain) {
                setCotisationMoisProchain((userProfile as any).cotisationMoisProchain);
              }
            } else if (isAdmin) {
              // Si l'utilisateur est admin, ne pas afficher de cotisations
              setCotisations([]);
              setObligationsCotisation([]);
              setDettesInitiales([]);
              setAvoirs([]);
              setCotisationsMois([]);
              setHistoriqueCotisations([]);
              setCotisationMoisProchain(null);
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
            if (userProfile?.adherent) {
              setEnfants((userProfile.adherent as any).Enfants || []);
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
  }, [activeSection, user]);

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

  const handleImageChange = async (imageUrl: string) => {
    setCurrentImage(imageUrl);
    try {
      const result = await updateUserData(
        {
          ...user,
          image: imageUrl
        },
        {},
        {},
        []
      );

      if (result.success) {
        toast.success("Photo mise à jour avec succès !");
        window.location.reload();
      } else {
        throw new Error(result.message || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'image:', error);
      toast.error("Erreur lors de la mise à jour de l'image");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <Navbar />
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
      case 'Admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Membre':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Invite':
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
  const userRole = (user as any)?.role || 'Membre';
  const userCreatedAt = (user as any)?.createdAt || new Date().toISOString();
  const userLastLogin = (user as any)?.lastLogin || null;

  // Menu latéral
  const menuItems = [
    {
      id: 'profile' as MenuSection,
      label: 'Mon Profil',
      icon: User,
      description: 'Informations personnelles'
    },
    {
      id: 'cotisations' as MenuSection,
      label: 'Mes Cotisations',
      icon: Euro,
      description: 'Cotisations et obligations'
    },
    {
      id: 'documents' as MenuSection,
      label: 'Mes Documents',
      icon: FileText,
      description: 'Gérer mes documents'
    },
    {
      id: 'badges' as MenuSection,
      label: 'Mes Badges',
      icon: Award,
      description: 'Mes récompenses et badges'
    },
    {
      id: 'passeport' as MenuSection,
      label: 'Mon Passeport',
      icon: Shield,
      description: 'Droits et obligations'
    },
    {
      id: 'statistiques' as MenuSection,
      label: 'Statistiques',
      icon: BarChart3,
      description: 'Mes statistiques personnelles'
    },
    {
      id: 'enfants' as MenuSection,
      label: 'Mes Enfants',
      icon: Baby,
      description: 'Gérer mes enfants'
    },
    {
      id: 'idees' as MenuSection,
      label: 'Mes Idées',
      icon: Lightbulb,
      description: 'Gérer mes idées'
    },
    {
      id: 'candidatures' as MenuSection,
      label: 'Mes Candidatures',
      icon: Vote,
      description: 'Candidatures soumises'
    },
    {
      id: 'votes' as MenuSection,
      label: 'Mes Votes',
      icon: Vote,
      description: 'Historique des votes'
    },
    {
      id: 'candidates' as MenuSection,
      label: 'Liste des Candidats',
      icon: Users,
      description: 'Voir tous les candidats'
    },
    {
      id: 'notifications' as MenuSection,
      label: 'Notifications',
      icon: Bell,
      description: 'Préférences de notifications'
    },
    {
      id: 'settings' as MenuSection,
      label: 'Paramètres',
      icon: Settings,
      description: 'Gestion du compte'
    }
  ];

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
              <Link href="/user/update" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white">
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier le profil
                </Button>
              </Link>
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
                      <p className="font-medium">{user.email || "Non renseigné"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Nom complet</p>
                      <p className="font-medium">{user.name || "Non renseigné"}</p>
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
            {profileLoading ? (
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
            ) : userProfile?.adherent ? (
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
                    <span className="font-medium">{userProfile.adherent.civility || "Non renseigné"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Prénom</span>
                    <span className="font-medium">{userProfile.adherent.firstname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Nom</span>
                    <span className="font-medium">{userProfile.adherent.lastname}</span>
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
                    <Link href="/user/update">
                      <Button className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        Compléter mon profil
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informations d'Adresse */}
            {profileLoading ? (
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
            ) : userProfile?.adherent?.Adresse && userProfile.adherent.Adresse.length > 0 ? (
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
                  {userProfile.adherent.Adresse.map((adresse, index) => (
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
                    <Link href="/user/update">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter une adresse
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informations des Téléphones */}
            {profileLoading ? (
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
            ) : userProfile?.adherent?.Telephones && userProfile.adherent.Telephones.length > 0 ? (
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
                  {userProfile.adherent.Telephones.map((telephone, index) => (
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
                    <Link href="/user/update">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter un téléphone
                      </Button>
                    </Link>
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

            {/* Afficher les cotisations du mois en cours */}
            {cotisationsMois.length > 0 && (() => {
              // Extraire le nom du mois depuis la première cotisation
              const premiereCotisation = cotisationsMois[0];
              let nomMois = "en cours";
              
              if (premiereCotisation?.periode) {
                // Format période: "2024-11"
                const [annee, mois] = premiereCotisation.periode.split('-');
                if (mois) {
                  const date = new Date(parseInt(annee), parseInt(mois) - 1, 1);
                  nomMois = date.toLocaleDateString('fr-FR', { month: 'long' });
                  // Capitaliser la première lettre
                  nomMois = nomMois.charAt(0).toUpperCase() + nomMois.slice(1);
                }
              } else if (premiereCotisation?.dateCotisation) {
                const date = new Date(premiereCotisation.dateCotisation);
                nomMois = date.toLocaleDateString('fr-FR', { month: 'long' });
                nomMois = nomMois.charAt(0).toUpperCase() + nomMois.slice(1);
              }
              
              return (
                <Card className="border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 !py-0">
                  <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white pb-3 pt-3 px-6 gap-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Receipt className="h-4 w-4" />
                      Cotisations du Mois de {nomMois}
                    </CardTitle>
                    <CardDescription className="text-blue-100 dark:text-blue-200 mt-1 text-xs">
                      Cotisations mensuelles + assistances du mois
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-3 pb-4 px-6">
                    <CotisationsMoisTable cotisations={cotisationsMois} />
                  </CardContent>
                </Card>
              );
            })()}

            {/* Afficher la cotisation prévisionnelle du mois prochain */}
            {cotisationMoisProchain && showCotisationMoisProchain && (
              <Card className="border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-900 !py-0">
                <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white pb-3 pt-3 px-6 gap-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4" />
                    Cotisation Prévisionnelle du Mois de {cotisationMoisProchain.nomMois}
                  </CardTitle>
                  <CardDescription className="text-purple-100 dark:text-purple-200 mt-1 text-xs">
                    Estimation basée sur le forfait mensuel + assistances prévues
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-3 pb-4 px-6">
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Forfait mensuel:
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {cotisationMoisProchain.montantForfait.toFixed(2).replace('.', ',')} €
                          </span>
                        </div>
                        
                        {cotisationMoisProchain.assistances && cotisationMoisProchain.assistances.length > 0 && (
                          <>
                            {cotisationMoisProchain.isBeneficiaire ? (
                              <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                                <div className="flex items-center gap-1 mb-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                                  <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                                    Vous êtes bénéficiaire
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 pl-4">
                                  {cotisationMoisProchain.assistances.map((ass: any) => (
                                    <div key={ass.id} className="mb-1">
                                      • {ass.type} - Vous ne payez pas cette assistance
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                      Total prévisionnel:
                                    </span>
                                    <span className="text-base font-bold text-green-600 dark:text-green-400">
                                      {cotisationMoisProchain.montantForfait.toFixed(2).replace('.', ',')} €
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                  Assistances prévues:
                                </div>
                                <div className="space-y-1 pl-2">
                                  {cotisationMoisProchain.assistances.map((ass: any) => (
                                    <div key={ass.id} className="text-xs text-gray-600 dark:text-gray-400">
                                      • {ass.type} pour {ass.adherent?.firstname} {ass.adherent?.lastname} ({ass.montant.toFixed(2).replace('.', ',')} €)
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                      Total prévisionnel:
                                    </span>
                                    <span className="text-base font-bold text-purple-600 dark:text-purple-400">
                                      {cotisationMoisProchain.montantTotal.toFixed(2).replace('.', ',')} €
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        
                        {(!cotisationMoisProchain.assistances || cotisationMoisProchain.assistances.length === 0) && (
                          <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Total prévisionnel:
                              </span>
                              <span className="text-base font-bold text-purple-600 dark:text-purple-400">
                                {cotisationMoisProchain.montantForfait.toFixed(2).replace('.', ',')} €
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                              Aucune assistance prévue pour ce mois
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-blue-800 dark:text-blue-200 leading-relaxed">
                          Cette cotisation est une estimation. Le montant final sera calculé lors de la génération des cotisations mensuelles par l'administrateur.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bouton pour afficher/masquer la cotisation prévisionnelle */}
            {cotisationMoisProchain && (
              <div className="flex justify-center pt-2 pb-2 border-t border-gray-200 dark:border-gray-700 mt-4">
                {!showCotisationMoisProchain ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCotisationMoisProchain(true)}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 h-8"
                  >
                    <Clock className="h-3 w-3 mr-1.5" />
                    Voir la cotisation prévisionnelle du mois prochain
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCotisationMoisProchain(false)}
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 h-8"
                  >
                    <X className="h-3 w-3 mr-1.5" />
                    Masquer
                  </Button>
                )}
              </div>
            )}

            {/* Afficher l'historique des cotisations par mois */}
            {historiqueCotisations.length > 0 && showHistoriqueCotisations && (
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
                  <HistoriqueCotisationsTable cotisations={historiqueCotisations} />
                </CardContent>
              </Card>
            )}

            {/* Bouton pour afficher/masquer l'historique des cotisations */}
            {historiqueCotisations.length > 0 && (
              <div className="flex justify-center pt-2 pb-2 border-t border-gray-200 dark:border-gray-700 mt-4">
                {!showHistoriqueCotisations ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistoriqueCotisations(true)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 h-8"
                  >
                    <History className="h-3 w-3 mr-1.5" />
                    Voir l'historique des cotisations par mois
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistoriqueCotisations(false)}
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 h-8"
                  >
                    <X className="h-3 w-3 mr-1.5" />
                    Masquer
                  </Button>
                )}
              </div>
            )}

            <FinancialTables 
              cotisations={cotisations}
              obligations={obligationsCotisation}
              loading={loading}
            />
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
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mes Votes</h2>
                <p className="text-gray-600 dark:text-gray-300">{votesCount} vote{votesCount > 1 ? 's' : ''} trouvé{votesCount > 1 ? 's' : ''}</p>
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
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <div className="space-y-6">
                {Object.entries(groupedVotes).map(([electionTitle, votesInElection]) => {
                  const votesList = votesInElection as any[];
                  return (
                    <div key={electionTitle}>
                      {votesGroupByElection && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{electionTitle}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{votesList.length} vote{votesList.length > 1 ? 's' : ''}</p>
                          </div>
                          <Badge className={getElectionStatusColor(votesList[0]?.election.status)}>
                            {votesList[0]?.election.status === 'Ouverte' ? 'Ouverte' : votesList[0]?.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                          </Badge>
                        </div>
                      )}

                      <div className="space-y-4">
                        {votesList.map((vote: any) => (
                          <Card key={vote.id} className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{vote.position.titre}</h3>
                                  {!votesGroupByElection && (
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{vote.election.titre}</p>
                                  )}
                                </div>
                                <Badge className={getElectionStatusColor(vote.election.status)}>
                                  {vote.election.status === 'Ouverte' ? 'Ouverte' : vote.election.status === 'Cloturee' ? 'Clôturée' : 'En préparation'}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-4 mb-4">
                                <Avatar className="w-12 h-12">
                                  <AvatarImage src={vote.candidacy.adherent.User.image || undefined} alt={`${vote.candidacy.adherent.firstname} ${vote.candidacy.adherent.lastname}`} />
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm">
                                    {vote.candidacy.adherent.firstname?.[0]}{vote.candidacy.adherent.lastname?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white">{vote.candidacy.adherent.firstname} {vote.candidacy.adherent.lastname}</p>
                                  <p className="text-sm text-gray-600 dark:text-gray-300">{vote.candidacy.adherent.civility}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Date du vote:</span>
                                  <span className="ml-2 font-medium">{new Date(vote.createdAt).toLocaleDateString('fr-FR')}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Heure:</span>
                                  <span className="ml-2 font-medium">{new Date(vote.createdAt).toLocaleTimeString('fr-FR')}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Candidat:</span>
                                  <span className="ml-2 font-medium">{vote.candidacy.adherent.firstname} {vote.candidacy.adherent.lastname}</span>
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
              <Card>
                <CardContent className="p-6 text-center">
                  <Vote className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun vote</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">Vous n'avez pas encore voté dans une élection.</p>
                  <Link href="/vote">
                    <Button>
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
          <div className="space-y-6">
            {/* En-tête avec titre et statistiques */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Liste des Candidats</h2>
                <p className="text-gray-600 dark:text-gray-300">
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
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <div className="space-y-6">
                {Object.entries(groupedCandidates).map(([electionTitle, candidatesInElection]) => {
                  const candidates = candidatesInElection as any[];
                  return (
                    <div key={electionTitle}>
                      {/* En-tête de groupe */}
                      {groupByElection && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {electionTitle}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
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
                      <div className="space-y-4">
                        {candidates.map((candidate: any) => (
                        <Card key={candidate.id} className="hover:shadow-lg transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                              <Avatar className="w-16 h-16">
                                <AvatarImage
                                  src={candidate.adherent.User.image || undefined}
                                  alt={`${candidate.adherent.firstname} ${candidate.adherent.lastname}`}
                                />
                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg">
                                  {candidate.adherent.firstname?.[0]}{candidate.adherent.lastname?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                  {candidate.adherent.firstname} {candidate.adherent.lastname}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                  {candidate.adherent.civility}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {candidate.adherent.User.email}
                                </p>
                              </div>
                              <div className="text-right space-y-2">
                                <Badge className={getCandidacyStatusColor(candidate.status)}>
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
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600 dark:text-gray-300">Poste:</span>
                                <span className="ml-2 font-medium">{candidate.position.titre}</span>
                              </div>
                              {!groupByElection && (
                                <div>
                                  <span className="text-gray-600 dark:text-gray-300">Élection:</span>
                                  <span className="ml-2 font-medium">{candidate.election.titre}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-600 dark:text-gray-300">Date de candidature:</span>
                                <span className="ml-2 font-medium">
                                  {new Date(candidate.createdAt).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-300">Heure:</span>
                                <span className="ml-2 font-medium">
                                  {new Date(candidate.createdAt).toLocaleTimeString('fr-FR')}
                                </span>
                              </div>
                            </div>

                            {candidate.motivation && (
                              <div className="mt-4">
                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Motivation:</p>
                                <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
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
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {searchTerm || selectedElection !== 'all' || selectedStatus !== 'all' 
                      ? 'Aucun résultat' 
                      : 'Aucun candidat'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
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
          ? new Date(userProfile.adherent.datePremiereAdhesion)
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
                      {user.image ? "Définie" : "Non définie"}
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
                  <Link href="/user/update" className="block">
                    <Button className="w-full" variant="outline">
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier le profil
                    </Button>
                  </Link>
                  <Button className="w-full" variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Sécurité
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Préférences
                  </Button>
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

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-3 sm:py-4 md:py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 md:gap-4">
            <div className="relative flex-shrink-0">
              <PhotoUpload
                currentImage={currentImage}
                userName={user.name || ""}
                onImageChange={handleImageChange}
                size="sm"
              />
            </div>
            
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-0.5 sm:mb-1">
                {user.name || "Utilisateur"}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-blue-100 mb-1 sm:mb-2 truncate">{user.email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 sm:gap-2">
                <Badge className={`${getStatusColor(userStatus)} text-xs`}>
                  <CheckCircle className="h-3 w-3 mr-0.5" />
                  {userStatus}
                </Badge>
                <Badge className={`${getRoleColor(userRole)} text-xs`}>
                  <Shield className="h-3 w-3 mr-0.5" />
                  {userRole}
                </Badge>
                {userProfile?.adherent?.PosteTemplate && (
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs">
                    <Award className="h-3 w-3 mr-0.5" />
                    {userProfile.adherent.PosteTemplate.libelle}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
              {userProfile?.adherent?.numeroPasseport && user?.status === 'Actif' && (
                <Button 
                  onClick={handleDownloadPasseport}
                  className="bg-white text-blue-600 hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 font-medium shadow-sm"
                  title={`Télécharger le passeport ${userProfile.adherent.numeroPasseport}`}
                >
                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Passeport</span>
                </Button>
              )}
              <Link href="/user/update">
                <Button className="bg-white text-blue-600 hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 font-medium shadow-sm">
                  <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Modifier</span>
                </Button>
              </Link>
              <Button className="bg-white/90 text-blue-600 hover:bg-white dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 font-medium shadow-sm">
                <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-1">Paramètres</span>
              </Button>
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