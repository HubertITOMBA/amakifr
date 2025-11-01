"use client";

import { useParams, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { getUserByIdForAdmin, adminUpdateUser, adminUpdateUserRole, adminUpdateUserStatus } from "@/actions/user";
import { UserRole, UserStatus } from "@prisma/client";
import { toast } from "sonner";

export default function EditionUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [isDirty, setIsDirty] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ name: string; email: string; role: UserRole; status: UserStatus }>({
    name: "",
    email: "",
    role: UserRole.Membre,
    status: UserStatus.Inactif,
  });
  const [initialForm, setInitialForm] = useState(form);

  useEffect(() => {
    if (id) {
      loadUser();
    }
  }, [id]);

  useEffect(() => {
    setIsDirty(JSON.stringify(form) !== JSON.stringify(initialForm));
  }, [form, initialForm]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const result = await getUserByIdForAdmin(id);
      if (result.success && result.user) {
        setUser(result.user);
        const init = {
          name: result.user.name || "",
          email: result.user.email || "",
          role: result.user.role,
          status: result.user.status,
        };
        setForm(init);
        setInitialForm(init);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      // Mettre à jour les informations de base
      const nameChanged = form.name !== initialForm.name;
      const emailChanged = form.email !== initialForm.email;
      const roleChanged = form.role !== initialForm.role;
      const statusChanged = form.status !== initialForm.status;

      // Mettre à jour nom et email
      if (nameChanged || emailChanged) {
        const res = await adminUpdateUser(user.id, {
          ...(nameChanged && { name: form.name }),
          ...(emailChanged && { email: form.email }),
        });
        if (!res.success) {
          toast.error(res.error || "Erreur lors de la mise à jour");
          return;
        }
      }

      // Mettre à jour le rôle
      if (roleChanged) {
        const res = await adminUpdateUserRole(user.id, form.role);
        if (!res.success) {
          toast.error(res.error || "Erreur lors de la mise à jour du rôle");
          return;
        }
      }

      // Mettre à jour le statut
      if (statusChanged) {
        const res = await adminUpdateUserStatus(user.id, form.status);
        if (!res.success) {
          toast.error(res.error || "Erreur lors de la mise à jour du statut");
          return;
        }
        toast.success("Statut mis à jour. Un email de notification a été envoyé à l'utilisateur.");
      } else {
        toast.success("Utilisateur mis à jour");
      }
      router.back();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  if (loading) {
    return (
      <Modal title="Éditer l'utilisateur" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!user) {
    return (
      <Modal title="Éditer l'utilisateur" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Utilisateur introuvable
        </div>
      </Modal>
    );
  }

  const fullName = user.adherent 
    ? `${user.adherent.civility || ''} ${user.adherent.firstname || ''} ${user.adherent.lastname || ''}`.trim()
    : user.name || "Sans nom";

  return (
    <Modal 
      title="Éditer l'utilisateur" 
      confirmOnClose={isDirty}
      confirmCloseMessage="Voulez-vous fermer sans enregistrer vos modifications ?"
      showFooter
      cancelLabel="Annuler"
      saveLabel="Enregistrer"
      onSave={handleSave}
      onCancel={() => router.back()}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nom complet (depuis adhérent)</Label>
            <Input value={fullName} disabled />
            <p className="text-xs text-gray-500 mt-1">Le nom est géré via le profil adhérent</p>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email"
              value={form.email} 
              onChange={(e) => setForm({ ...form, email: e.target.value })} 
            />
          </div>
          <div>
            <Label htmlFor="name">Nom d'affichage</Label>
            <Input 
              id="name" 
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
            />
          </div>
          <div>
            <Label>Rôle</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.Admin}>Admin</SelectItem>
                <SelectItem value={UserRole.Membre}>Membre</SelectItem>
                <SelectItem value={UserRole.Invite}>Invité</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Statut</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as UserStatus })}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserStatus.Actif}>Actif</SelectItem>
                <SelectItem value={UserStatus.Inactif}>Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Modal>
  );
}

