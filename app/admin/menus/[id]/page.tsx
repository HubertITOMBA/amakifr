"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Menu as MenuIcon, Loader2 } from "lucide-react";
import { getMenuById, updateMenu } from "@/actions/menus";
import { toast } from "react-toastify";
import Link from "next/link";

const MENU_ROLES = [
  "ADMIN",
  "PRESID",
  "VICEPR",
  "SECRET",
  "VICESE",
  "COMCPT",
  "MEMBRE",
  "INVITE",
  "VISITEUR",
];

export default function EditMenuPage() {
  const router = useRouter();
  const params = useParams();
  const menuId = params.id as string;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [formData, setFormData] = useState({
    libelle: "",
    description: "",
    lien: "",
    niveau: "NAVBAR" as "NAVBAR" | "SIDEBAR",
    roles: [] as string[],
    icone: "",
    statut: true,
    ordre: 0,
    electoral: false,
  });

  // Charger les données du menu
  useEffect(() => {
    const loadMenu = async () => {
      try {
        setInitialLoading(true);
        const result = await getMenuById(menuId);
        
        if (result.success && result.data) {
          const menu = result.data;
          setFormData({
            libelle: menu.libelle,
            description: menu.description || "",
            lien: menu.lien,
            niveau: menu.niveau as "NAVBAR" | "SIDEBAR",
            roles: menu.roles,
            icone: menu.icone || "",
            statut: menu.statut,
            ordre: menu.ordre,
            electoral: menu.electoral,
          });
        } else {
          toast.error(result.error || "Erreur lors du chargement du menu");
          router.push("/admin/menus");
        }
      } catch (error) {
        console.error("Erreur:", error);
        toast.error("Erreur lors du chargement du menu");
        router.push("/admin/menus");
      } finally {
        setInitialLoading(false);
      }
    };

    if (menuId) {
      loadMenu();
    }
  }, [menuId, router]);

  const handleRoleToggle = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("libelle", formData.libelle);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("lien", formData.lien);
      formDataToSend.append("niveau", formData.niveau);
      formDataToSend.append("roles", JSON.stringify(formData.roles));
      formDataToSend.append("icone", formData.icone);
      formDataToSend.append("statut", String(formData.statut));
      formDataToSend.append("ordre", String(formData.ordre));
      formDataToSend.append("electoral", String(formData.electoral));

      const result = await updateMenu(menuId, formDataToSend);

      if (result.success) {
        toast.success(result.message);
        router.push("/admin/menus");
        router.refresh();
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour du menu");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <Card className="mx-auto max-w-4xl shadow-lg border-blue-200 dark:border-slate-700 !py-0">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white !p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <CardTitle className="flex items-center gap-2 !p-0">
              <MenuIcon className="h-6 w-6" />
              Modifier un menu
            </CardTitle>
          </div>
        </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <Card className="mx-auto max-w-4xl shadow-lg border-blue-200 dark:border-slate-700 !py-0">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white !p-0">
          <div className="flex items-center justify-between px-6 py-4">
            <CardTitle className="flex items-center gap-2 !p-0">
              <MenuIcon className="h-6 w-6" />
              Modifier le menu
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Libellé */}
            <div className="space-y-2">
              <Label htmlFor="libelle" className="text-sm font-semibold">
                Libellé <span className="text-red-500">*</span>
              </Label>
              <Input
                id="libelle"
                value={formData.libelle}
                onChange={(e) =>
                  setFormData({ ...formData, libelle: e.target.value })
                }
                placeholder="Ex: Événements"
                required
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-semibold">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Description du menu"
                maxLength={500}
                rows={3}
              />
            </div>

            {/* Lien */}
            <div className="space-y-2">
              <Label htmlFor="lien" className="text-sm font-semibold">
                Lien <span className="text-red-500">*</span>
              </Label>
              <Input
                id="lien"
                value={formData.lien}
                onChange={(e) =>
                  setFormData({ ...formData, lien: e.target.value })
                }
                placeholder="Ex: /evenements"
                required
                maxLength={255}
              />
            </div>

            {/* Niveau */}
            <div className="space-y-2">
              <Label htmlFor="niveau" className="text-sm font-semibold">
                Niveau <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.niveau}
                onValueChange={(value: "NAVBAR" | "SIDEBAR") =>
                  setFormData({ ...formData, niveau: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAVBAR">NAVBAR (Navigation publique)</SelectItem>
                  <SelectItem value="SIDEBAR">SIDEBAR (Menu admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rôles */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Rôles autorisés <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border rounded-md">
                {MENU_ROLES.map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={`role-${role}`}
                      checked={formData.roles.includes(role)}
                      onCheckedChange={() => handleRoleToggle(role)}
                    />
                    <label
                      htmlFor={`role-${role}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {role}
                    </label>
                  </div>
                ))}
              </div>
              {formData.roles.length === 0 && (
                <p className="text-xs text-red-500">
                  Au moins un rôle doit être sélectionné
                </p>
              )}
            </div>

            {/* Icône */}
            <div className="space-y-2">
              <Label htmlFor="icone" className="text-sm font-semibold">
                Icône (Lucide)
              </Label>
              <Input
                id="icone"
                value={formData.icone}
                onChange={(e) =>
                  setFormData({ ...formData, icone: e.target.value })
                }
                placeholder="Ex: Calendar, Users, Shield"
                maxLength={100}
              />
              <p className="text-xs text-gray-500">
                Voir:{" "}
                <a
                  href="https://lucide.dev/icons"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  lucide.dev/icons
                </a>
              </p>
            </div>

            {/* Ordre */}
            <div className="space-y-2">
              <Label htmlFor="ordre" className="text-sm font-semibold">
                Ordre d'affichage
              </Label>
              <Input
                id="ordre"
                type="number"
                value={formData.ordre}
                onChange={(e) =>
                  setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })
                }
                min={0}
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="statut"
                  checked={formData.statut}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, statut: !!checked })
                  }
                />
                <label
                  htmlFor="statut"
                  className="text-sm font-medium cursor-pointer"
                >
                  Menu actif
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="electoral"
                  checked={formData.electoral}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, electoral: !!checked })
                  }
                />
                <label
                  htmlFor="electoral"
                  className="text-sm font-medium cursor-pointer"
                >
                  Menu électoral (soumis au paramètre electoral_menu_enabled)
                </label>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex gap-4 pt-4">
              <Link href="/admin/menus" className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
              </Link>
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={loading || formData.roles.length === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
