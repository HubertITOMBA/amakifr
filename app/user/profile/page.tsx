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
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  MessageSquare,
  ThumbsUp,
  Trash2,
  Pencil,
  Info
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUserProfile } from "@/hooks/use-user-profile";
import { PhotoUpload } from "@/components/ui/photo-upload";
import { updateUserData, getUserCandidatures, getUserVotes, getAllCandidatesForProfile } from "@/actions/user";
import { toast } from "sonner";
import { FinancialTables } from "@/components/financial/financial-tables";
import { getIdeesByUser, createIdee, updateIdee, deleteIdee } from "@/actions/idees";
import { StatutIdee } from "@prisma/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
type MenuSection = 'profile' | 'cotisations' | 'candidatures' | 'votes' | 'candidates' | 'idees' | 'settings';

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
            className="h-8 px-2 lg:px-3 font-semibold text-red-900 dark:text-red-300"
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
            className="h-8 px-2 lg:px-3 font-semibold text-gray-900 dark:text-gray-300"
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
            className="h-8 px-2 lg:px-3 font-semibold text-green-900 dark:text-green-300"
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
            className="h-8 px-2 lg:px-3 font-semibold text-red-900 dark:text-red-300"
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
          <span className="text-sm text-gray-600 dark:text-gray-400">
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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-red-50 dark:bg-red-900/20">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="font-semibold text-center">
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
                  <TableCell key={cell.id} className="text-center">
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
                  <p className="text-gray-500">Aucune dette initiale trouvée.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
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
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
            <span className={`text-sm font-medium ${restant > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
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
              <span className="text-sm font-bold text-green-600 dark:text-green-400">
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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-indigo-50 dark:bg-indigo-900/20">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="font-semibold text-center">
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
                  <TableCell key={cell.id} className="text-center">
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
                  <p className="text-gray-500">Aucun historique de cotisation disponible.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
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
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dateCotisation', desc: true }]);

  const columnHelper = createColumnHelper<CotisationMois>();

  const columns = useMemo<ColumnDef<CotisationMois>[]>(
    () => [
      columnHelper.accessor('type', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2 lg:px-3 font-semibold text-blue-900 dark:text-blue-300"
          >
            Type
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : null}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 justify-center">
            <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">{row.getValue('type')}</span>
          </div>
        ),
      }),
      columnHelper.accessor('montant', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2 lg:px-3 font-semibold text-gray-900 dark:text-gray-300"
          >
            Montant
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
      columnHelper.accessor('description', {
        header: 'Détails',
        cell: ({ row }) => {
          const description = row.getValue('description') as string | undefined;
          if (!description) return <span className="text-sm text-gray-500">-</span>;
          
          // Parser la description pour afficher de manière plus lisible
          // Format attendu: "Cotisation 2024-11 : Forfait 15,00€ + Assistances: AnniversaireSalle pour Nom Prénom (50,00€) = Total: 65,00€"
          // ou "Cotisation 2024-11 : Forfait 15,00€ - Bénéficiaire de: AnniversaireSalle (bénéficiaire) (ne paie pas l'assistance)"
          
          // Extraire les informations
          const parts = description.split(' : ');
          if (parts.length < 2) {
            return <div className="text-xs text-gray-600 dark:text-gray-400">{description}</div>;
          }
          
          const periode = parts[0];
          const details = parts[1];
          
          // Vérifier si c'est un bénéficiaire ou un contributeur
          const isBeneficiaire = details.includes('Bénéficiaire de:');
          const hasAssistances = details.includes('+ Assistances:');
          
          return (
            <div className="text-xs text-left max-w-lg space-y-1.5">
              <div className="font-semibold text-blue-700 dark:text-blue-300">
                {periode}
              </div>
              
              {isBeneficiaire ? (
                // Cas bénéficiaire : ne paie que le forfait
                <div className="space-y-1 pl-2 border-l-2 border-green-300 dark:border-green-700">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      Forfait mensuel: 15,00€
                    </span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 italic pl-4">
                    {details.split('Bénéficiaire de:')[1]?.split('(ne paie pas')[0]?.trim() || ''}
                  </div>
                  <div className="text-green-600 dark:text-green-400 font-semibold text-[10px]">
                    ✓ Vous êtes bénéficiaire, vous ne payez pas l'assistance
                  </div>
                </div>
              ) : hasAssistances ? (
                // Cas contributeur : paie forfait + assistances
                <div className="space-y-1.5 pl-2 border-l-2 border-blue-300 dark:border-blue-700">
                  <div className="flex items-center gap-1">
                    <Euro className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      Forfait mensuel: 15,00€
                    </span>
                  </div>
                  
                  {details.includes('+ Assistances:') && (
                    <div className="space-y-1 pl-4">
                      <div className="text-gray-600 dark:text-gray-400 font-medium">
                        Assistances du mois:
                      </div>
                      {details.split('+ Assistances:')[1]?.split(' = ')[0]?.split(',').map((ass: string, idx: number) => (
                        <div key={idx} className="text-gray-600 dark:text-gray-400 pl-2 text-[10px]">
                          • {ass.trim()}
                        </div>
                      )) || (
                        <div className="text-gray-600 dark:text-gray-400 pl-2 text-[10px]">
                          • {details.split('+ Assistances:')[1]?.split(' = ')[0]?.trim()}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {details.includes(' = Total:') && (
                    <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
                      <div className="font-bold text-blue-600 dark:text-blue-400">
                        {details.split(' = ')[1]}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Format simple
                <div className="text-gray-600 dark:text-gray-400 pl-2">
                  {details}
                </div>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('montantRestant', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2 lg:px-3 font-semibold text-red-900 dark:text-red-300"
          >
            Restant
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
      columnHelper.accessor('statut', {
        header: 'Statut',
        cell: ({ row }) => {
          const statut = row.getValue('statut');
          const montantRestant = parseFloat(row.original.montantRestant.toString());
          const isPaye = montantRestant === 0 || statut === 'Paye' || statut === 'Valide';
          
          return (
            <Badge className={
              isPaye
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : statut === 'EnRetard'
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }>
              {isPaye ? 'Payée' : statut === 'EnRetard' ? 'En retard' : 'En attente'}
            </Badge>
          );
        },
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
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Payée
              </Badge>
            );
          }
          
          // Déterminer le type de paiement
          let paymentUrl = '/paiement?';
          if (row.original.isCotisationMensuelle) {
            paymentUrl += `type=cotisation-mensuelle&id=${row.original.cotisationMensuelleId}`;
          } else if (row.original.isAssistance) {
            paymentUrl += `type=assistance&id=${row.original.assistanceId}`;
          } else {
            paymentUrl += `type=cotisation&id=${row.original.id}`;
          }
          
          return (
            <a href={paymentUrl}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                <CreditCard className="h-4 w-4 mr-2" />
                Payer
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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-blue-50 dark:bg-blue-900/20">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="font-semibold text-center">
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
                  <TableCell key={cell.id} className="text-center">
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
                  <p className="text-gray-500">Aucune cotisation du mois en cours.</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
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
  const [avoirs, setAvoirs] = useState<any[]>([]);
  const [historiqueCotisations, setHistoriqueCotisations] = useState<any[]>([]);
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
  const [ideesLoading, setIdeesLoading] = useState(false);
  const [showCreateIdeeDialog, setShowCreateIdeeDialog] = useState(false);
  const [showEditIdeeDialog, setShowEditIdeeDialog] = useState(false);
  const [editingIdee, setEditingIdee] = useState<any>(null);
  const [ideeFormData, setIdeeFormData] = useState({ titre: '', description: '' });

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
            if (userProfile?.adherent) {
              setCotisations((userProfile.adherent as any).Cotisations || []);
              setObligationsCotisation((userProfile.adherent as any).ObligationsCotisation || []);
              setDettesInitiales((userProfile.adherent as any).DettesInitiales || []);
              setAvoirs((userProfile.adherent as any).Avoirs || []);
              
              // Construire la liste des cotisations du mois : cotisations mensuelles + assistances du mois
              const cotisationsMensuelles = ((userProfile.adherent as any).CotisationsMensuelles || []).map((cm: any) => ({
                id: cm.id,
                type: cm.TypeCotisation?.nom || 'Cotisation',
                montant: Number(cm.montantAttendu),
                montantPaye: Number(cm.montantPaye),
                montantRestant: Number(cm.montantRestant),
                dateCotisation: cm.dateEcheance,
                periode: cm.periode,
                statut: cm.statut,
                description: cm.description,
                moyenPaiement: 'Non payé',
                reference: cm.id,
                isCotisationMensuelle: true,
                cotisationMensuelleId: cm.id
              }));
              
              const assistances = ((userProfile.adherent as any).Assistances || []).map((ass: any) => ({
                id: ass.id,
                type: `Assistance ${ass.type}`,
                montant: Number(ass.montant),
                montantPaye: Number(ass.montantPaye),
                montantRestant: Number(ass.montantRestant),
                dateCotisation: ass.dateEvenement,
                periode: `${new Date(ass.dateEvenement).getFullYear()}-${String(new Date(ass.dateEvenement).getMonth() + 1).padStart(2, '0')}`,
                statut: ass.statut === 'EnAttente' ? 'EnAttente' : ass.statut === 'Paye' ? 'Valide' : 'EnAttente',
                description: `Assistance pour ${ass.type}`,
                moyenPaiement: 'Non payé',
                reference: ass.id,
                isAssistance: true,
                assistanceId: ass.id
              }));
              
              setCotisationsMois([...cotisationsMensuelles, ...assistances]);
              
              // Construire l'historique des cotisations mensuelles avec leurs paiements
              const toutesCotisationsMensuelles = ((userProfile.adherent as any).CotisationsMensuelles || []);
              setHistoriqueCotisations(toutesCotisationsMensuelles);
              
              // Récupérer la cotisation du mois prochain
              if ((userProfile as any).cotisationMoisProchain) {
                setCotisationMoisProchain((userProfile as any).cotisationMoisProchain);
              }
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
          case 'idees':
            setIdeesLoading(true);
            const ideesResult = await getIdeesByUser(user.id);
            if (ideesResult.success && ideesResult.data) {
              setIdees(ideesResult.data || []);
            } else {
              toast.error(ideesResult.error || "Erreur lors du chargement des idées");
            }
            setIdeesLoading(false);
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
      icon: DollarSign,
      description: 'Cotisations et obligations'
    },
    {
      id: 'candidatures' as MenuSection,
      label: 'Mes Candidatures',
      icon: FileText,
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
      id: 'idees' as MenuSection,
      label: 'Mes Idées',
      icon: Lightbulb,
      description: 'Gérer mes idées'
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
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mon Profil</h2>
                <p className="text-gray-600 dark:text-gray-300">Gérez vos informations personnelles</p>
              </div>
              <Link href="/user/update">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
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
                          new Date(userLastLogin).toLocaleString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) :
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
            {cotisationMoisProchain && (
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

            {/* Historique des cotisations par mois */}
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
                  <HistoriqueCotisationsTable cotisations={historiqueCotisations} />
                </CardContent>
              </Card>
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

        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mes Idées</h2>
                <p className="text-gray-600 dark:text-gray-300">Gérez vos idées soumises à la boîte à idées</p>
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
                          <CardTitle className="text-lg mb-2">{idee.titre}</CardTitle>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {format(new Date(idee.dateCreation), "d MMMM yyyy", { locale: fr })}
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
      <section className="relative py-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              <PhotoUpload
                currentImage={currentImage}
                userName={user.name || ""}
                onImageChange={handleImageChange}
                size="lg"
              />
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                {user.name || "Utilisateur"}
              </h1>
              <p className="text-xl text-blue-100 mb-4">{user.email}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <Badge className={getStatusColor(userStatus)}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {userStatus}
                </Badge>
                <Badge className={getRoleColor(userRole)}>
                  <Shield className="h-4 w-4 mr-1" />
                  {userRole}
                </Badge>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Link href="/user/update">
                <Button variant="outline" className="border-white text-white hover:bg-white/10">
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
              </Link>
              <Button variant="outline" className="border-white text-white hover:bg-white/10">
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu principal avec menu latéral */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Menu latéral */}
            <div className="lg:col-span-1">
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