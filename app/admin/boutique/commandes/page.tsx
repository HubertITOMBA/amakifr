"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, ArrowLeft, Eye, ClipboardList } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { getAllMerchOrders } from "@/actions/boutique";
import {
  formatMerchPrice,
  MERCH_ORDER_STATUS_LABELS,
  MERCH_PAYMENT_STATUS_LABELS,
  getMerchOrderStatusBadgeClass,
  getMerchPaymentStatusBadgeClass,
} from "@/lib/boutique";
import { MerchOrderDetailDialog, type MerchOrderDetail } from "@/components/boutique/MerchOrderDetailDialog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Page dédiée listant toutes les commandes boutique (admin)
 * (séparée de /admin/boutique pour des raisons de performance)
 */
export default function AdminBoutiqueCommandesPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<MerchOrderDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const res = await getAllMerchOrders();
    if (res.success && res.data) setOrders(res.data);
    else toast.error(res.error || "Erreur de chargement des commandes");
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const t = setTimeout(() => setGlobalFilter(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "all" && order.statut !== statusFilter) return false;
      if (!globalFilter.trim()) return true;
      const q = globalFilter.trim().toLowerCase();
      const text = [
        order.numeroCommande || "",
        order.nom || "",
        order.email || "",
        order.statut || "",
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [orders, statusFilter, globalFilter]);

  const openDetail = (order: MerchOrderDetail) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleOrderUpdated = (order: MerchOrderDetail) => {
    setSelectedOrder(order);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-3 sm:p-6">
      <Card className="mx-auto w-full max-w-6xl shadow-lg border-blue-200 dark:border-blue-800">
        <CardHeader className="bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-t-lg px-5 py-5 sm:px-6 sm:py-6">
          <CardTitle className="flex flex-wrap items-center gap-3 text-xl sm:text-2xl lg:text-3xl font-bold">
            <ClipboardList className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
            <span>Commandes — Boutique</span>
            <Badge className="bg-white/20 text-white border-white/30 text-sm sm:text-base px-3 py-1">
              {orders.length} commande{orders.length > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/admin/boutique">
              <Button
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/30"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour boutique
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="pt-6 px-4 sm:px-6 space-y-4">
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div className="flex flex-col sm:flex-row flex-1 gap-3 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Rechercher (numéro, nom, email)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white dark:bg-slate-900"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-56 bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {Object.entries(MERCH_ORDER_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                className="border-blue-300 hover:bg-blue-50"
                onClick={loadOrders}
              >
                Actualiser
              </Button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              {filteredOrders.length} commande{filteredOrders.length > 1 ? "s" : ""} affichée{filteredOrders.length > 1 ? "s" : ""}
              {filteredOrders.length !== orders.length && ` sur ${orders.length}`}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 border border-dashed rounded-xl">
              Aucune commande ne correspond aux filtres sélectionnés.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <Card
                  key={order.id}
                  className="border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => openDetail(order as MerchOrderDetail)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-wrap justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-base">{order.numeroCommande}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {order.nom} — {order.email}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge className={getMerchOrderStatusBadgeClass(order.statut)}>
                            {MERCH_ORDER_STATUS_LABELS[order.statut] || order.statut}
                          </Badge>
                          <Badge className={getMerchPaymentStatusBadgeClass(order.statutPaiement || "EnAttente")}>
                            {MERCH_PAYMENT_STATUS_LABELS[order.statutPaiement || "EnAttente"]}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-blue-600 text-lg">{formatMerchPrice(order.montantTotal)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.createdAt), "dd MMM yyyy HH:mm", { locale: fr })}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 border-blue-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(order as MerchOrderDetail);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Détail
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MerchOrderDetailDialog
        order={selectedOrder}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdated={handleOrderUpdated}
      />
    </div>
  );
}

