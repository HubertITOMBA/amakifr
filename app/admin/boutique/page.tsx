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
  getAllMerchOrders,
} from "@/actions/boutique";
import { formatMerchPrice, type MerchVariantInput } from "@/lib/boutique";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const columnHelper = createColumnHelper<any>();

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
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [actif, setActif] = useState(true);
  const [ordre, setOrdre] = useState(0);
  const [variants, setVariants] = useState<MerchVariantInput[]>([emptyVariant()]);
  const [images, setImages] = useState<any[]>([]);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

  const productId = editing?.id as string | undefined;

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const res = await getAllMerchProducts();
    if (res.success && res.data) setProducts(res.data);
    else toast.error(res.error || "Erreur de chargement");
    setLoading(false);
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    const res = await getAllMerchOrders();
    if (res.success && res.data) setOrders(res.data);
    else toast.error(res.error || "Erreur de chargement des commandes");
    setOrdersLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const t = setTimeout(() => setGlobalFilter(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

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

  const columns = useMemo(
    () => [
      columnHelper.accessor("imageCover", {
        id: "image",
        header: "Photo",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="relative h-12 w-12 rounded-md overflow-hidden bg-slate-100">
            {row.original.imageCover ? (
              <Image src={row.original.imageCover} alt="" fill className="object-cover" unoptimized={row.original.imageCover?.startsWith("/")} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <ShoppingBag className="h-5 w-5 text-slate-400" />
              </div>
            )}
          </div>
        ),
        size: 70,
      }),
      columnHelper.accessor("titre", {
        header: "Titre",
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
        cell: ({ row }) => {
          const prices = row.original.variants?.map((v: any) => Number(v.prix)) || [];
          const min = prices.length ? Math.min(...prices) : null;
          return <span className="text-sm">{min != null ? formatMerchPrice(min) : "—"}</span>;
        },
      }),
      columnHelper.display({
        id: "stock",
        header: "Stock total",
        cell: ({ row }) => {
          const stock =
            row.original.variants?.reduce((s: number, v: any) => s + (v.stock || 0), 0) || 0;
          return <span className="text-sm">{stock}</span>;
        },
      }),
      columnHelper.accessor("actif", {
        header: "Statut",
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
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(row.original)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 border-red-300 hover:bg-red-50"
              onClick={() => handleDelete(row.original.id)}
            >
              <Trash2 className="h-3 w-3 text-red-600" />
            </Button>
          </div>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: products,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, globalFilter, columnVisibility },
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4 sm:p-6">
      <Card className="mx-auto max-w-7xl shadow-lg border-blue-200 dark:border-blue-800">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Boutique — Produits dérivés ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs defaultValue="produits" onValueChange={(v) => v === "commandes" && loadOrders()}>
            <TabsList className="mb-6">
              <TabsTrigger value="produits">Produits</TabsTrigger>
              <TabsTrigger value="commandes">Commandes</TabsTrigger>
            </TabsList>

            <TabsContent value="produits" className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher un produit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <ColumnVisibilityToggle table={table} storageKey="admin-boutique-columns" />
                  <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouveau produit
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <DataTable table={table} emptyMessage="Aucun produit" compact headerBold />
              )}
            </TabsContent>

            <TabsContent value="commandes">
              {ordersLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : orders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucune commande pour le moment</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <Card key={order.id} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="flex flex-wrap justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold">{order.numeroCommande}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.nom} — {order.email}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600">{formatMerchPrice(order.montantTotal)}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(order.createdAt), "dd MMM yyyy HH:mm", { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <ul className="text-sm space-y-1">
                          {order.items.map((item: any) => (
                            <li key={item.id}>
                              {item.productTitre} — {item.taille}/{item.couleur} × {item.quantite}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit dérivé"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={actif} onCheckedChange={setActif} />
                <Label>Produit actif</Label>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Variantes (taille / couleur / prix / stock) *</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setVariants([...variants, emptyVariant()])}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </div>
              <div className="space-y-2">
                {variants.map((v, idx) => (
                  <div key={idx} className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2 border rounded-md">
                    <Input placeholder="Taille" value={v.taille} onChange={(e) => {
                      const n = [...variants]; n[idx].taille = e.target.value; setVariants(n);
                    }} />
                    <Input placeholder="Couleur" value={v.couleur} onChange={(e) => {
                      const n = [...variants]; n[idx].couleur = e.target.value; setVariants(n);
                    }} />
                    <Input type="number" placeholder="Prix €" value={v.prix} onChange={(e) => {
                      const n = [...variants]; n[idx].prix = parseFloat(e.target.value) || 0; setVariants(n);
                    }} />
                    <Input type="number" placeholder="Stock" value={v.stock} onChange={(e) => {
                      const n = [...variants]; n[idx].stock = parseInt(e.target.value, 10) || 0; setVariants(n);
                    }} />
                    {variants.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setVariants(variants.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
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

          <DialogFooter>
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
