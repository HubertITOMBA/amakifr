"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShoppingBag,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  ImagePlus,
  Package,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Eye,
  ClipboardList,
  AlertTriangle,
  Boxes,
  Download,
  History,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  getPaginationRowModel,
  VisibilityState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";
import {
  getAllMerchProducts,
  createMerchProduct,
  updateMerchProduct,
  deleteMerchProduct,
  uploadMerchProductImage,
  deleteMerchProductImage,
  getMerchOrderStats,
  getMerchStockOverview,
  updateMerchVariantStock,
  getMerchStockMovements,
  exportMerchStockMovementsCsv,
  type MerchOrderStats,
  type MerchStockLine,
  type MerchStockMovementRow,
} from "@/actions/boutique";
import {
  formatMerchPrice,
  type MerchVariantInput,
  MERCH_ORDER_STATUS_LABELS,
  getMerchOrderStatusBadgeClass,
  getMerchStockLevel,
  getMerchProductStockLevel,
  MERCH_STOCK_LEVEL_LABELS,
  getMerchStockLevelBadgeClass,
  MERCH_DEFAULT_STOCK_ALERT_THRESHOLD,
  MERCH_STOCK_MOVEMENT_LABELS,
} from "@/lib/boutique";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";

const columnHelper = createColumnHelper<any>();

const MERCH_VARIANT_COLOR_PRESETS: Array<{ label: string; hex: string }> = [
  { label: "Noir", hex: "#0f172a" },
  { label: "Blanc", hex: "#ffffff" },
  { label: "Gris", hex: "#94a3b8" },
  { label: "Rouge", hex: "#ef4444" },
  { label: "Bordeaux", hex: "#7f1d1d" },
  { label: "Orange", hex: "#f97316" },
  { label: "Jaune", hex: "#eab308" },
  { label: "Vert", hex: "#22c55e" },
  { label: "Bleu", hex: "#3b82f6" },
  { label: "Marine", hex: "#1e3a8a" },
  { label: "Violet", hex: "#a855f7" },
  { label: "Rose", hex: "#ec4899" },
];

function getMerchColorHexFromLabel(label: string): string | null {
  const found = MERCH_VARIANT_COLOR_PRESETS.find(
    (c) => c.label.toLowerCase() === (label || "").trim().toLowerCase()
  );
  return found?.hex || null;
}

const emptyVariant = (): MerchVariantInput => ({
  taille: "",
  couleur: "",
  prix: 0,
  stock: 0,
  actif: true,
});

/**
 * Page admin de gestion de la boutique produits dérivés
 */
export default function AdminBoutiquePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderStats, setOrderStats] = useState<MerchOrderStats>({
    total: 0,
    montantTotal: 0,
    paymentReceived: 0,
    paymentPending: 0,
    byStatus: {},
    last30DaysCount: 0,
    last30DaysRevenue: 0,
  });
  const [orderStatsLoading, setOrderStatsLoading] = useState(false);
  const [orderStatsLoaded, setOrderStatsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return { prix: false, stock: false, actif: false };
    }
    return {};
  });
  const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [actif, setActif] = useState(true);
  const [ordre, setOrdre] = useState(0);
  const [seuilAlerteStock, setSeuilAlerteStock] = useState(MERCH_DEFAULT_STOCK_ALERT_THRESHOLD);
  const [variants, setVariants] = useState<MerchVariantInput[]>([emptyVariant()]);
  const [images, setImages] = useState<any[]>([]);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

  const [stockLines, setStockLines] = useState<MerchStockLine[]>([]);
  const [stockSummary, setStockSummary] = useState({ total: 0, rupture: 0, faible: 0, ok: 0 });
  const [stockLoading, setStockLoading] = useState(false);
  const [stockLoaded, setStockLoaded] = useState(false);
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [stockSearch, setStockSearch] = useState("");
  const [savingStockId, setSavingStockId] = useState<string | null>(null);
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState("produits");
  const [stockMovements, setStockMovements] = useState<MerchStockMovementRow[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsLoaded, setMovementsLoaded] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const productId = editing?.id as string | undefined;

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const res = await getAllMerchProducts();
    if (res.success && res.data) {
      setProducts(res.data);
      let rupture = 0;
      let faible = 0;
      let ok = 0;
      let total = 0;
      for (const product of res.data.filter((p: any) => p.actif)) {
        const seuil = product.seuilAlerteStock ?? MERCH_DEFAULT_STOCK_ALERT_THRESHOLD;
        for (const variant of product.variants || []) {
          if (variant.actif === false) continue;
          total += 1;
          const niveau = getMerchStockLevel(variant.stock, seuil);
          if (niveau === "rupture") rupture += 1;
          else if (niveau === "faible") faible += 1;
          else ok += 1;
        }
      }
      setStockSummary({ total, rupture, faible, ok });
    } else toast.error(res.error || "Erreur de chargement");
    setLoading(false);
  }, []);

  const loadOrderStats = useCallback(
    async (force = false) => {
      if (!force && orderStatsLoaded) return;
      setOrderStatsLoading(true);
      const res = await getMerchOrderStats({
        statut: orderStatusFilter === "all" ? "all" : (orderStatusFilter as any),
      });
      if (res.success && res.data) {
        setOrderStats(res.data);
        setOrderStatsLoaded(true);
      } else {
        toast.error(res.error || "Erreur de chargement des statistiques");
      }
      setOrderStatsLoading(false);
    },
    [orderStatsLoaded, orderStatusFilter]
  );

  const loadStock = useCallback(async (force = false) => {
    if (!force && stockLoaded) return;
    setStockLoading(true);
    const res = await getMerchStockOverview();
    if (res.success && res.data) {
      setStockLines(res.data.lines);
      setStockSummary(res.data.summary);
      const edits: Record<string, number> = {};
      res.data.lines.forEach((line) => {
        edits[line.variantId] = line.stock;
      });
      setStockEdits(edits);
    } else {
      toast.error(res.error || "Erreur de chargement du stock");
    }
    setStockLoading(false);
    if (res.success) setStockLoaded(true);
  }, [stockLoaded]);

  const loadMovements = useCallback(async (force = false) => {
    if (!force && movementsLoaded) return;
    setMovementsLoading(true);
    const res = await getMerchStockMovements(100);
    if (res.success && res.data) setStockMovements(res.data);
    else toast.error(res.error || "Erreur de chargement de l'historique");
    setMovementsLoading(false);
    if (res.success) setMovementsLoaded(true);
  }, [movementsLoaded]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const t = setTimeout(() => setGlobalFilter(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setColumnVisibility((prev) => ({
          ...prev,
          prix: false,
          stock: false,
          actif: false,
        }));
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (statusFilter === "actif" && !product.actif) return false;
      if (statusFilter === "inactif" && product.actif) return false;

      if (globalFilter.trim()) {
        const q = globalFilter.trim().toLowerCase();
        const searchText = [
          product.titre || "",
          product.slug || "",
          product.description || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!searchText.includes(q)) return false;
      }

      return true;
    });
  }, [products, globalFilter, statusFilter]);

  const stockAlertCount = useMemo(() => {
    return stockSummary.rupture + stockSummary.faible;
  }, [stockSummary.rupture, stockSummary.faible]);

  const filteredStockLines = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    return stockLines.filter((line) => {
      if (stockFilter !== "all" && line.niveau !== stockFilter) return false;
      if (!q) return true;
      const text = [line.productTitre, line.taille, line.couleur].join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [stockLines, stockFilter, stockSearch]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "commandes") loadOrderStats(false);
    if (value === "stock") {
      loadStock(false);
      loadMovements(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "commandes") return;
    setOrderStatsLoaded(false);
    loadOrderStats(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatusFilter]);

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetPendingImages();
  };

  const resetPendingImages = () => {
    pendingPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPendingImages([]);
    setPendingPreviews([]);
  };

  const openCreate = () => {
    setEditing(null);
    setTitre("");
    setDescription("");
    setActif(true);
    setOrdre(0);
    setSeuilAlerteStock(MERCH_DEFAULT_STOCK_ALERT_THRESHOLD);
    setVariants([emptyVariant()]);
    setImages([]);
    resetPendingImages();
    setDialogOpen(true);
  };

  const openEdit = (product: any) => {
    resetPendingImages();
    setEditing(product);
    setTitre(product.titre);
    setDescription(product.description || "");
    setActif(product.actif);
    setOrdre(product.ordre || 0);
    setSeuilAlerteStock(product.seuilAlerteStock ?? MERCH_DEFAULT_STOCK_ALERT_THRESHOLD);
    setVariants(
      product.variants?.length
        ? product.variants.map((v: any) => ({
            id: v.id,
            taille: v.taille,
            couleur: v.couleur,
            prix: Number(v.prix),
            stock: v.stock,
            actif: v.actif,
          }))
        : [emptyVariant()]
    );
    setImages(product.images || []);
    setDialogOpen(true);
  };

  const validateForm = () => {
    if (!titre.trim()) {
      toast.error("Le titre est obligatoire");
      return false;
    }
    const validVariants = variants.filter((v) => v.taille.trim() && v.couleur.trim());
    if (validVariants.length === 0) {
      toast.error("Ajoutez au moins une variante avec taille et couleur");
      return false;
    }
    if (validVariants.some((v) => Number.isNaN(v.prix) || v.prix < 0)) {
      toast.error("Le prix doit être un nombre positif ou nul");
      return false;
    }
    return true;
  };

  const uploadImagesForProduct = async (targetProductId: string, files: File[], existingCount: number) => {
    let uploaded = 0;
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.append("productId", targetProductId);
      fd.append("file", files[i]);
      fd.append("estPrincipale", existingCount === 0 && i === 0 ? "true" : "false");
      const res = await uploadMerchProductImage(fd);
      if (res.success) uploaded += 1;
      else toast.error(res.error || `Erreur upload image ${i + 1}`);
    }
    return uploaded;
  };

  const refreshProductInDialog = async (targetProductId: string) => {
    const refreshed = await getAllMerchProducts();
    const updated = refreshed.data?.find((p: any) => p.id === targetProductId);
    if (updated) {
      setEditing(updated);
      setImages(updated.images || []);
    }
    await loadProducts();
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    const payload = {
      titre: titre.trim(),
      description: description || null,
      actif,
      ordre,
      seuilAlerteStock,
      variants: variants.filter((v) => v.taille.trim() && v.couleur.trim()),
    };

    try {
      const res = editing?.id
        ? await updateMerchProduct({ id: editing.id, ...payload })
        : await createMerchProduct(payload);

      if (!res.success || !res.data?.id) {
        toast.error(res.error || "Erreur lors de l'enregistrement");
        return;
      }

      const savedId = res.data.id as string;
      setEditing(res.data);
      setImages(res.data.images || []);

      let uploadCount = 0;
      if (pendingImages.length > 0) {
        uploadCount = await uploadImagesForProduct(
          savedId,
          pendingImages,
          (res.data.images || []).length
        );
        resetPendingImages();
        await refreshProductInDialog(savedId);
      } else {
        await loadProducts();
      }

      if (stockLoaded) await loadStock(true);

      toast.success(
        uploadCount > 0
          ? `${res.message} — ${uploadCount} image(s) ajoutée(s).`
          : res.message
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    const res = await deleteMerchProduct(id);
    if (res.success) {
      toast.success(res.message);
      loadProducts();
    } else toast.error(res.error || "Erreur");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!productId) {
      const previewUrl = URL.createObjectURL(file);
      setPendingImages((prev) => [...prev, file]);
      setPendingPreviews((prev) => [...prev, previewUrl]);
      e.target.value = "";
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("productId", productId);
    fd.append("file", file);
    fd.append("estPrincipale", images.length === 0 ? "true" : "false");
    const res = await uploadMerchProductImage(fd);
    if (res.success) {
      toast.success(res.message);
      await refreshProductInDialog(productId);
    } else toast.error(res.error || "Erreur upload");
    setUploading(false);
    e.target.value = "";
  };

  const removePendingImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDeleteImage = async (imageId: string) => {
    const res = await deleteMerchProductImage(imageId);
    if (res.success) {
      toast.success(res.message);
      await loadProducts();
      setImages((prev) => prev.filter((i) => i.id !== imageId));
    } else toast.error(res.error || "Erreur");
  };

  const handleSaveVariantStock = async (variantId: string) => {
    const stock = stockEdits[variantId];
    if (stock === undefined || stock < 0) {
      toast.error("Quantité invalide");
      return;
    }
    setSavingStockId(variantId);
    const res = await updateMerchVariantStock({ variantId, stock });
    if (res.success) {
      toast.success(res.message || "Stock mis à jour");
      await loadStock(true);
      await loadMovements(true);
      await loadProducts();
    } else {
      toast.error(res.error || "Erreur lors de la mise à jour");
    }
    setSavingStockId(null);
  };

  const handleExportStockCsv = async () => {
    setExportingCsv(true);
    const res = await exportMerchStockMovementsCsv();
    if (res.success && res.data) {
      const blob = new Blob(["\uFEFF" + res.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.data.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Export CSV téléchargé");
    } else {
      toast.error(res.error || "Erreur lors de l'export");
    }
    setExportingCsv(false);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor("imageCover", {
        id: "image",
        header: "Photo",
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <div className="relative h-10 w-10 rounded-md overflow-hidden bg-slate-100 shrink-0">
              {row.original.imageCover ? (
                <Image src={row.original.imageCover} alt="" fill className="object-cover" unoptimized={row.original.imageCover?.startsWith("/")} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <ShoppingBag className="h-4 w-4 text-slate-400" />
                </div>
              )}
            </div>
          </div>
        ),
        size: 56,
        minSize: 56,
        maxSize: 56,
      }),
      columnHelper.accessor("titre", {
        header: "Titre",
        size: 280,
        minSize: 160,
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-sm">{row.original.titre}</p>
            <p className="text-xs text-muted-foreground">{row.original.slug}</p>
          </div>
        ),
      }),
      columnHelper.display({
        id: "prix",
        header: "Prix min",
        size: 110,
        minSize: 90,
        maxSize: 140,
        cell: ({ row }) => {
          const prices = row.original.variants?.map((v: any) => Number(v.prix)) || [];
          const min = prices.length ? Math.min(...prices) : null;
          return <span className="text-sm">{min != null ? formatMerchPrice(min) : "—"}</span>;
        },
      }),
      columnHelper.display({
        id: "stock",
        header: "Stock",
        size: 130,
        minSize: 110,
        maxSize: 160,
        cell: ({ row }) => {
          const seuil = row.original.seuilAlerteStock ?? MERCH_DEFAULT_STOCK_ALERT_THRESHOLD;
          const totalStock =
            row.original.variants?.reduce((s: number, v: any) => s + (v.stock || 0), 0) || 0;
          const niveau = getMerchProductStockLevel(row.original.variants || [], seuil);
          return (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{totalStock}</span>
              <Badge className={`text-[10px] w-fit border ${getMerchStockLevelBadgeClass(niveau)}`}>
                {MERCH_STOCK_LEVEL_LABELS[niveau]}
              </Badge>
            </div>
          );
        },
      }),
      columnHelper.accessor("actif", {
        header: "Statut",
        size: 100,
        minSize: 90,
        maxSize: 120,
        cell: ({ row }) => (
          <Badge className={row.original.actif ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
            {row.original.actif ? "Actif" : "Inactif"}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        meta: { forceVisible: true },
        enableSorting: false,
        enableResizing: false,
        size: 96,
        minSize: 96,
        maxSize: 96,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-blue-300 hover:bg-blue-50"
              onClick={() => openEdit(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-red-300 hover:bg-red-50"
              onClick={() => handleDelete(row.original.id)}
            >
              <Trash2 className="h-3.5 w-3.5 text-red-600" />
            </Button>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const getProductMinPrice = (product: any) => {
    const prices = product.variants?.map((v: any) => Number(v.prix)) || [];
    return prices.length ? Math.min(...prices) : null;
  };

  const getProductTotalStock = (product: any) =>
    product.variants?.reduce((s: number, v: any) => s + (v.stock || 0), 0) || 0;

  const toggleMobileExpand = (productId: string) => {
    setExpandedMobileId((current) => (current === productId ? null : productId));
  };

  const table = useReactTable({
    data: filteredProducts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, globalFilter, columnVisibility },
    initialState: { pagination: { pageSize: 10 } },
    defaultColumn: {
      minSize: 80,
      maxSize: 600,
    },
  });

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-3 sm:p-6">
      <Card className="mx-auto w-full max-w-6xl shadow-lg border-blue-200 dark:border-blue-800">
        <CardHeader className="bg-linear-to-r from-blue-500 to-blue-600 text-white rounded-t-lg px-5 py-5 sm:px-6 sm:py-6">
          <CardTitle className="flex flex-wrap items-center gap-3 text-xl sm:text-2xl lg:text-3xl font-bold">
            <ShoppingBag className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
            <span>Boutique — Produits dérivés</span>
            <Badge className="bg-white/20 text-white border-white/30 text-sm sm:text-base px-3 py-1">
              {products.length} produit{products.length > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <p className="text-blue-100 text-sm sm:text-base mt-2 max-w-3xl">
            Gérez le catalogue, les variantes, les images et consultez les commandes des adhérents.
          </p>
        </CardHeader>
        <CardContent className="pt-6 px-4 sm:px-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-6 h-11">
              <TabsTrigger value="produits" className="text-sm sm:text-base px-4">Produits</TabsTrigger>
              <TabsTrigger value="stock" className="text-sm sm:text-base px-4 gap-2">
                <Boxes className="h-4 w-4 hidden sm:inline" />
                Stock
                {stockAlertCount > 0 && (
                  <Badge className="bg-amber-500 text-white text-xs px-1.5 py-0 min-w-5">
                    {stockAlertCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="commandes" className="text-sm sm:text-base px-4">Commandes</TabsTrigger>
            </TabsList>

            <TabsContent value="produits" className="space-y-4">
              {(stockSummary.rupture > 0 || stockSummary.faible > 0) && (
                <div
                  className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
                    stockSummary.rupture > 0
                      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                      : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                  }`}
                >
                  <AlertTriangle
                    className={`h-5 w-5 shrink-0 ${
                      stockSummary.rupture > 0 ? "text-red-600" : "text-amber-600"
                    }`}
                  />
                  <div className="flex-1 text-sm">
                    {stockSummary.rupture > 0 && (
                      <p className="font-semibold text-red-800 dark:text-red-200">
                        {stockSummary.rupture} variante{stockSummary.rupture > 1 ? "s" : ""} en rupture de stock
                      </p>
                    )}
                    {stockSummary.faible > 0 && (
                      <p className={stockSummary.rupture > 0 ? "text-red-700 dark:text-red-300 mt-1" : "font-semibold text-amber-800 dark:text-amber-200"}>
                        {stockSummary.faible} variante{stockSummary.faible > 1 ? "s" : ""} sous le seuil d&apos;alerte
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-blue-300 hover:bg-blue-50"
                    onClick={() => handleTabChange("stock")}
                  >
                    Voir le stock
                  </Button>
                </div>
              )}
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-200">
                  <Filter className="h-4 w-4" />
                  Filtres
                </div>
                <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                  <div className="flex flex-col sm:flex-row flex-1 gap-3 min-w-0">
                    <div className="flex flex-1 min-w-0 gap-2 items-stretch">
                      <div
                        className="flex items-center justify-center px-3.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shrink-0"
                        aria-hidden
                      >
                        <Search className="h-4 w-4 text-slate-500" />
                      </div>
                      <Input
                        placeholder="Rechercher par titre, slug ou description..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-52 bg-white dark:bg-slate-900">
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        <SelectItem value="actif">Actifs uniquement</SelectItem>
                        <SelectItem value="inactif">Inactifs uniquement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <ColumnVisibilityToggle table={table} storageKey="admin-boutique-columns" />
                    <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Nouveau produit
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""} affiché{filteredProducts.length > 1 ? "s" : ""}
                  {filteredProducts.length !== products.length && ` sur ${products.length}`}
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                  Aucun produit ne correspond aux filtres sélectionnés.
                </div>
              ) : (
                <>
                  {/* Liste mobile : 2 colonnes + chevron pour détails/actions */}
                  <div className="md:hidden space-y-2">
                    {filteredProducts.map((product) => {
                      const isExpanded = expandedMobileId === product.id;
                      const minPrice = getProductMinPrice(product);
                      const totalStock = getProductTotalStock(product);

                      return (
                        <div
                          key={product.id}
                          className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm"
                        >
                          <div className="grid grid-cols-[1fr_auto] items-center gap-2 p-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                                {product.imageCover ? (
                                  <Image
                                    src={product.imageCover}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    unoptimized={product.imageCover?.startsWith("/")}
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    <ShoppingBag className="h-5 w-5 text-slate-400" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2">
                                  {product.titre}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{product.slug}</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 w-9 p-0 border-blue-300 shrink-0"
                              onClick={() => toggleMobileExpand(product.id)}
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? "Masquer les détails" : "Voir les détails et actions"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-blue-600" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-600" />
                              )}
                            </Button>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-blue-100 dark:border-blue-900 px-3 py-3 space-y-3 bg-blue-50/40 dark:bg-blue-950/20">
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <p className="text-xs text-muted-foreground">Prix min</p>
                                  <p className="font-medium">{minPrice != null ? formatMerchPrice(minPrice) : "—"}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Stock total</p>
                                  <p className="font-medium">{totalStock}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-xs text-muted-foreground mb-1">Statut</p>
                                  <Badge className={product.actif ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                                    {product.actif ? "Actif" : "Inactif"}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 border-blue-300 hover:bg-blue-50"
                                  onClick={() => openEdit(product)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Modifier
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 border-red-300 hover:bg-red-50 text-red-600"
                                  onClick={() => handleDelete(product.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tableau desktop */}
                  <div className="hidden md:block">
                    <DataTable table={table} emptyMessage="Aucun produit" compact headerBold headerUppercase={false} resizable />
                  </div>

                  {/* Pagination desktop */}
                  <div className="hidden md:flex bg-white dark:bg-gray-800 mt-5 flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4">
                    <div className="ml-5 text-sm text-muted-foreground dark:text-gray-400">
                      {table.getFilteredRowModel().rows.length} ligne(s) au total
                    </div>
                    <div className="flex items-center space-x-6 lg:space-x-8 mr-5">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lignes par page</p>
                        <Select
                          value={`${table.getState().pagination.pageSize}`}
                          onValueChange={(value) => table.setPageSize(Number(value))}
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
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="h-8 w-8 p-0" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="h-8 w-8 p-0" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="stock" className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stockSummary.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">Variantes actives</p>
                </div>
                <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stockSummary.ok}</p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">Stock OK</p>
                </div>
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stockSummary.faible}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Stock bas</p>
                </div>
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stockSummary.rupture}</p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">Ruptures</p>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Rechercher produit, taille ou couleur..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      className="pl-10 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger className="w-full sm:w-52 bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Niveau de stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les niveaux</SelectItem>
                      <SelectItem value="rupture">Rupture uniquement</SelectItem>
                      <SelectItem value="faible">Stock bas uniquement</SelectItem>
                      <SelectItem value="ok">Stock OK uniquement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {filteredStockLines.length} variante{filteredStockLines.length > 1 ? "s" : ""} affichée{filteredStockLines.length > 1 ? "s" : ""}
                  {stockLines.length > 0 && filteredStockLines.length !== stockLines.length && ` sur ${stockLines.length}`}
                </p>
              </div>

              {stockLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : filteredStockLines.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                  {stockLines.length === 0
                    ? "Aucune variante active. Ouvrez l'onglet pour charger les données."
                    : "Aucune variante ne correspond aux filtres."}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="hidden md:grid grid-cols-[1fr_80px_80px_80px_100px_120px] gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    <span>Produit / variante</span>
                    <span className="text-center">Stock</span>
                    <span className="text-center">Seuil</span>
                    <span className="text-center">Niveau</span>
                    <span className="text-center">Réappro.</span>
                    <span className="text-center">Action</span>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredStockLines.map((line) => (
                      <div
                        key={line.variantId}
                        className="p-3 md:grid md:grid-cols-[1fr_80px_80px_80px_100px_120px] md:gap-2 md:items-center hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <div className="min-w-0 mb-2 md:mb-0">
                          <p className="font-medium text-sm truncate">{line.productTitre}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.taille} — {line.couleur}
                          </p>
                        </div>
                        <div className="flex items-center justify-between md:justify-center gap-2 mb-2 md:mb-0">
                          <span className="text-xs text-muted-foreground md:hidden">Stock actuel</span>
                          <span className="text-sm font-mono font-semibold">{line.stock}</span>
                        </div>
                        <div className="flex items-center justify-between md:justify-center gap-2 mb-2 md:mb-0">
                          <span className="text-xs text-muted-foreground md:hidden">Seuil alerte</span>
                          <span className="text-sm">{line.seuilAlerte}</span>
                        </div>
                        <div className="flex items-center justify-between md:justify-center gap-2 mb-2 md:mb-0">
                          <span className="text-xs text-muted-foreground md:hidden">Niveau</span>
                          <Badge className={`text-[10px] border ${getMerchStockLevelBadgeClass(line.niveau)}`}>
                            {MERCH_STOCK_LEVEL_LABELS[line.niveau]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2 md:mb-0 md:justify-center">
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-20 text-sm"
                            value={stockEdits[line.variantId] ?? line.stock}
                            onChange={(e) =>
                              setStockEdits((prev) => ({
                                ...prev,
                                [line.variantId]: parseInt(e.target.value, 10) || 0,
                              }))
                            }
                          />
                        </div>
                        <div className="flex gap-2 md:justify-center">
                          <Button
                            size="sm"
                            className="h-8 bg-blue-600 hover:bg-blue-700"
                            disabled={
                              savingStockId === line.variantId ||
                              stockEdits[line.variantId] === line.stock
                            }
                            onClick={() => handleSaveVariantStock(line.variantId)}
                          >
                            {savingStockId === line.variantId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Enregistrer"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-blue-300"
                            onClick={() => {
                              const product = products.find((p) => p.id === line.productId);
                              if (product) openEdit(product);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-blue-600" />
                    <h3 className="font-semibold text-sm sm:text-base">Historique des mouvements</h3>
                    <Badge variant="outline" className="text-xs">
                      {stockMovements.length} entrée{stockMovements.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-300 hover:bg-blue-50"
                    disabled={exportingCsv || movementsLoading}
                    onClick={handleExportStockCsv}
                  >
                    {exportingCsv ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Exporter CSV
                  </Button>
                </div>

                {movementsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                  </div>
                ) : stockMovements.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground text-sm">
                    Aucun mouvement enregistré pour le moment.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-[420px] overflow-y-auto">
                    {stockMovements.map((movement) => (
                      <div
                        key={movement.id}
                        className="p-3 sm:grid sm:grid-cols-[140px_1fr_80px_80px_80px] sm:gap-3 sm:items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm"
                      >
                        <p className="text-xs text-muted-foreground mb-1 sm:mb-0">
                          {format(new Date(movement.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                        </p>
                        <div className="min-w-0 mb-2 sm:mb-0">
                          <p className="font-medium truncate">{movement.productTitre}</p>
                          <p className="text-xs text-muted-foreground">
                            {movement.taille} — {movement.couleur}
                            {movement.numeroCommande && (
                              <span className="ml-1">· {movement.numeroCommande}</span>
                            )}
                          </p>
                          {movement.motif && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{movement.motif}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-between sm:justify-center gap-2 mb-1 sm:mb-0">
                          <span className="text-xs text-muted-foreground sm:hidden">Type</span>
                          <Badge variant="outline" className="text-[10px]">
                            {MERCH_STOCK_MOVEMENT_LABELS[movement.type] || movement.type}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between sm:justify-center gap-2 mb-1 sm:mb-0">
                          <span className="text-xs text-muted-foreground sm:hidden">Variation</span>
                          <span
                            className={`font-mono font-semibold ${
                              movement.quantite < 0 ? "text-red-600" : movement.quantite > 0 ? "text-green-600" : ""
                            }`}
                          >
                            {movement.quantite > 0 ? `+${movement.quantite}` : movement.quantite}
                          </span>
                        </div>
                        <div className="flex items-center justify-between sm:justify-center gap-2">
                          <span className="text-xs text-muted-foreground sm:hidden">Stock</span>
                          <span className="font-mono text-xs">
                            {movement.stockAvant} → {movement.stockApres}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="commandes" className="space-y-4">
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-200">
                  <ClipboardList className="h-4 w-4" />
                  Statistiques commandes
                </div>
                <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                  <SelectTrigger className="w-full sm:w-56 bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les commandes</SelectItem>
                    {Object.entries(MERCH_ORDER_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {orderStatsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-center">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{orderStats.total}</p>
                      <p className="text-xs text-muted-foreground mt-1">Commandes (filtre)</p>
                    </div>
                    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 text-center">
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {formatMerchPrice(orderStats.montantTotal)}
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Chiffre d&apos;affaires</p>
                    </div>
                    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 text-center">
                      <p className="text-2xl font-bold text-green-700 dark:text-green-300">{orderStats.paymentReceived}</p>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1">Paiements reçus</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
                      <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{orderStats.paymentPending}</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Paiements en attente</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={getMerchOrderStatusBadgeClass("EnAttente")}>
                        {MERCH_ORDER_STATUS_LABELS.EnAttente}
                      </Badge>
                      <span className="text-sm font-semibold">{orderStats.byStatus.EnAttente || 0}</span>
                      <Badge className={getMerchOrderStatusBadgeClass("Confirmee")}>
                        {MERCH_ORDER_STATUS_LABELS.Confirmee}
                      </Badge>
                      <span className="text-sm font-semibold">{orderStats.byStatus.Confirmee || 0}</span>
                      <Badge className={getMerchOrderStatusBadgeClass("Expediee")}>
                        {MERCH_ORDER_STATUS_LABELS.Expediee}
                      </Badge>
                      <span className="text-sm font-semibold">{orderStats.byStatus.Expediee || 0}</span>
                      <Badge className={getMerchOrderStatusBadgeClass("Livree")}>
                        {MERCH_ORDER_STATUS_LABELS.Livree}
                      </Badge>
                      <span className="text-sm font-semibold">{orderStats.byStatus.Livree || 0}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
                      <p className="text-xs text-muted-foreground">
                        30 derniers jours : {orderStats.last30DaysCount} commande{orderStats.last30DaysCount > 1 ? "s" : ""} — {formatMerchPrice(orderStats.last30DaysRevenue)}
                      </p>
                      <Link href="/admin/boutique/commandes" className="sm:ml-2">
                        <Button variant="outline" className="border-blue-300 hover:bg-blue-50">
                          <Eye className="h-4 w-4 mr-2" />
                          Voir toutes les commandes
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden p-0 gap-0 border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white p-6 rounded-t-lg shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {editing ? <Pencil className="h-6 w-6 text-white" /> : <Plus className="h-6 w-6 text-white" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-bold text-white mb-1">
                  {editing ? "Modifier le produit" : "Nouveau produit dérivé"}
                </DialogTitle>
                <DialogDescription className="text-blue-100 text-sm">
                  {editing
                    ? "Mettre à jour les informations, variantes et images du produit"
                    : "Créer un produit dérivé avec ses variantes et images"}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 min-h-0">
            <div>
              <Label>Titre *</Label>
              <Input value={titre} onChange={(e) => setTitre(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Ordre d&apos;affichage</Label>
                <Input type="number" value={ordre} onChange={(e) => setOrdre(Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label>Seuil d&apos;alerte stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={seuilAlerteStock}
                  onChange={(e) => setSeuilAlerteStock(parseInt(e.target.value, 10) || 0)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Alerte si une variante passe à {seuilAlerteStock} unité{seuilAlerteStock > 1 ? "s" : ""} ou moins
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={actif} onCheckedChange={setActif} />
              <Label>Produit actif</Label>
            </div>

            <div>
              <Label className="mb-2 block">Variantes (taille / couleur / prix / stock) *</Label>
              <div className="space-y-3">
                {variants.map((v, idx) => (
                  <div key={idx} className="space-y-3 p-3 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50/50 dark:bg-slate-900/30">
                    {/* Ligne 1 : taille à gauche, action à droite */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <Label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Taille</Label>
                        <Input
                          placeholder="Ex: M, L, XL"
                          value={v.taille}
                          onChange={(e) => {
                            const n = [...variants];
                            n[idx].taille = e.target.value;
                            setVariants(n);
                          }}
                          className="mt-1"
                        />
                      </div>
                      <div className="shrink-0">
                        {idx === variants.length - 1 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-blue-300 hover:bg-blue-50"
                            onClick={() => setVariants([...variants, emptyVariant()])}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Ajouter
                          </Button>
                        ) : variants.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {/* Ligne 2 : couleur seule */}
                    <div>
                      <Label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Couleur</Label>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 mb-2">
                        {MERCH_VARIANT_COLOR_PRESETS.map((c) => {
                          const selected =
                            (v.couleur || "").trim().toLowerCase() === c.label.toLowerCase();
                          return (
                            <button
                              key={c.label}
                              type="button"
                              title={c.label}
                              className={`h-6 w-6 rounded-full border transition-all ${
                                selected
                                  ? "ring-2 ring-blue-500 border-blue-500"
                                  : "border-slate-300 hover:border-slate-400"
                              }`}
                              style={{ backgroundColor: c.hex }}
                              onClick={() => {
                                const n = [...variants];
                                n[idx].couleur = c.label;
                                setVariants(n);
                              }}
                            />
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-8 w-8 rounded-md border border-slate-300 bg-slate-100 shrink-0"
                          style={{
                            backgroundColor: getMerchColorHexFromLabel(v.couleur) || "#f1f5f9",
                          }}
                          title={v.couleur ? `Couleur: ${v.couleur}` : "Couleur non définie"}
                        />
                        <Input
                          placeholder="Couleur (ex: Noir)"
                          value={v.couleur}
                          onChange={(e) => {
                            const n = [...variants];
                            n[idx].couleur = e.target.value;
                            setVariants(n);
                          }}
                        />
                      </div>
                    </div>

                    {/* Ligne 3 : prix à gauche, stock à droite */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Prix (€)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={v.prix}
                          onChange={(e) => {
                            const n = [...variants];
                            n[idx].prix = parseFloat(e.target.value) || 0;
                            setVariants(n);
                          }}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Stock</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={v.stock}
                          onChange={(e) => {
                            const n = [...variants];
                            n[idx].stock = parseInt(e.target.value, 10) || 0;
                            setVariants(n);
                          }}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Images du produit</Label>
              {!productId && (
                <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1.5 mt-1 mb-2">
                  Vous pouvez sélectionner les images maintenant. Elles seront envoyées automatiquement lors de l&apos;enregistrement.
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {images.map((img) => (
                  <div key={img.id} className="relative h-20 w-20 rounded border overflow-hidden group">
                    <Image src={img.chemin} alt="" fill className="object-cover" unoptimized={img.chemin?.startsWith("/")} />
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      onClick={() => handleDeleteImage(img.id)}
                    >
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ))}
                {pendingPreviews.map((preview, idx) => (
                  <div key={`pending-${idx}`} className="relative h-20 w-20 rounded border overflow-hidden group border-dashed border-blue-300">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      onClick={() => removePendingImage(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ))}
                <label className="h-20 w-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5 text-slate-400" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading || saving}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Dossier : public/ressources/produits-derives/</p>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 pt-2 shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Fermer</Button>
            <Button onClick={handleSave} disabled={saving || uploading} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
              {productId ? "Enregistrer" : "Créer le produit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
