"use client";

import { useParams, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { getUserByIdForAdmin, adminUpdateUser, adminUpdateUserRole, adminUpdateUserStatus } from "@/actions/user";
import { adminUpdateAdherent } from "@/actions/user/admin-update-adherent";
import { getAllPostesTemplates } from "@/actions/postes";
import { UserRole, UserStatus } from "@prisma/client";
import { toast } from "react-toastify";
import { User, Mail, Calendar, Briefcase, Shield, MapPin, Phone, Image as ImageIcon } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function EditionUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [isDirty, setIsDirty] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [postes, setPostes] = useState<any[]>([]);
  
  const [userForm, setUserForm] = useState<{ name: string; email: string; role: UserRole; status: UserStatus; image: string }>({
    name: "",
    email: "",
    role: UserRole.Membre,
    status: UserStatus.Inactif,
    image: "",
  });
  
  const [adherentForm, setAdherentForm] = useState<{
    civility: string | null;
    firstname: string;
    lastname: string;
    dateNaissance: string | null;
    typeAdhesion: string | null;
    profession: string | null;
    centresInteret: string | null;
    autorisationImage: boolean;
    accepteCommunications: boolean;
    nombreEnfants: number;
    posteTemplateId: string | null;
  }>({
    civility: null,
    firstname: "",
    lastname: "",
    dateNaissance: null,
    typeAdhesion: null,
    profession: null,
    centresInteret: null,
    autorisationImage: false,
    accepteCommunications: true,
    nombreEnfants: 0,
    posteTemplateId: null,
  });
  
  const [initialUserForm, setInitialUserForm] = useState(userForm);
  const [initialAdherentForm, setInitialAdherentForm] = useState(adherentForm);

  useEffect(() => {
    if (id) {
      loadUser();
      loadPostes();
    }
  }, [id]);

  useEffect(() => {
    const userChanged = JSON.stringify(userForm) !== JSON.stringify(initialUserForm);
    const adherentChanged = JSON.stringify(adherentForm) !== JSON.stringify(initialAdherentForm);
    setIsDirty(userChanged || adherentChanged);
  }, [userForm, adherentForm, initialUserForm, initialAdherentForm]);

  const loadPostes = async () => {
    try {
      const res = await getAllPostesTemplates(true);
      if (res.success && res.data) {
        setPostes(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadUser = async () => {
    try {
      setLoading(true);
      const result = await getUserByIdForAdmin(id);
      if (result.success && result.user) {
        setUser(result.user);
        const userInit = {
          name: result.user.name || "",
          email: result.user.email || "",
          role: result.user.role,
          status: result.user.status,
          image: result.user.image || "",
        };
        setUserForm(userInit);
        setInitialUserForm(userInit);

        if (result.user.adherent) {
          const adherent = result.user.adherent;
          const adherentInit = {
            civility: adherent.civility || null,
            firstname: adherent.firstname || "",
            lastname: adherent.lastname || "",
            dateNaissance: adherent.dateNaissance ? formatDate(adherent.dateNaissance) : null,
            typeAdhesion: adherent.typeAdhesion || null,
            profession: adherent.profession || null,
            centresInteret: adherent.centresInteret || null,
            autorisationImage: adherent.autorisationImage || false,
            accepteCommunications: adherent.accepteCommunications !== false,
            nombreEnfants: adherent.nombreEnfants || 0,
            posteTemplateId: adherent.PosteTemplate?.id || null,
          };
          setAdherentForm(adherentInit);
          setInitialAdherentForm(adherentInit);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      // Mettre à jour les informations utilisateur
      const nameChanged = userForm.name !== initialUserForm.name;
      const emailChanged = userForm.email !== initialUserForm.email;
      const imageChanged = userForm.image !== initialUserForm.image;
      const roleChanged = userForm.role !== initialUserForm.role;
      const statusChanged = userForm.status !== initialUserForm.status;

      if (nameChanged || emailChanged || imageChanged) {
        const res = await adminUpdateUser(user.id, {
          ...(nameChanged && { name: userForm.name }),
          ...(emailChanged && { email: userForm.email }),
          ...(imageChanged && { image: userForm.image }),
        });
        if (!res.success) {
          toast.error(res.error || "Erreur lors de la mise à jour");
          return;
        }
      }

      if (roleChanged) {
        const res = await adminUpdateUserRole(user.id, userForm.role);
        if (!res.success) {
          toast.error(res.error || "Erreur lors de la mise à jour du rôle");
          return;
        }
      }

      if (statusChanged) {
        const res = await adminUpdateUserStatus(user.id, userForm.status);
        if (!res.success) {
          toast.error(res.error || "Erreur lors de la mise à jour du statut");
          return;
        }
      }

      // Mettre à jour les informations adhérent
      if (user.adherent) {
        const adherentChanged = JSON.stringify(adherentForm) !== JSON.stringify(initialAdherentForm);
        if (adherentChanged) {
          const res = await adminUpdateAdherent(user.adherent.id, {
            civility: adherentForm.civility as any,
            firstname: adherentForm.firstname,
            lastname: adherentForm.lastname,
            dateNaissance: adherentForm.dateNaissance || null,
            typeAdhesion: adherentForm.typeAdhesion as any,
            profession: adherentForm.profession || null,
            centresInteret: adherentForm.centresInteret || null,
            autorisationImage: adherentForm.autorisationImage,
            accepteCommunications: adherentForm.accepteCommunications,
            nombreEnfants: adherentForm.nombreEnfants,
            posteTemplateId: adherentForm.posteTemplateId || null,
          });
          if (!res.success) {
            toast.error(res.error || "Erreur lors de la mise à jour de l'adhérent");
            return;
          }
        }
      }

      if (statusChanged) {
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
      <div className="space-y-2 sm:space-y-3 max-h-[85vh] overflow-y-auto px-1">
        {/* Informations utilisateur */}
        <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg py-1.5 px-2 sm:px-3">
            <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
              <User className="h-3.5 w-3.5" />
              Informations utilisateur
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5 px-2 sm:px-3 pb-2 sm:pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  <ImageIcon className="h-3 w-3" />
                  Photo de profil
                </Label>
                <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 shadow-sm">
                  <ImageUpload
                    value={userForm.image || ""}
                    onChange={(url) => setUserForm({ ...userForm, image: url })}
                    label=""
                    folder="users"
                    maxSize={5}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  <Mail className="h-3 w-3" />
                  Email
                </Label>
                <Input 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                  type="email"
                  value={userForm.email} 
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  <User className="h-3 w-3" />
                  Nom d'affichage
                </Label>
                <Input 
                  className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                  value={userForm.name} 
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  <Shield className="h-3 w-3" />
                  Rôle
                </Label>
                <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v as UserRole })}>
                  <SelectTrigger className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8">
                    <SelectValue placeholder="Choisir un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserRole.Admin}>Admin</SelectItem>
                    <SelectItem value={UserRole.Membre}>Membre</SelectItem>
                    <SelectItem value={UserRole.Invite}>Invité</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                  <Shield className="h-3 w-3" />
                  Statut
                </Label>
                <Select value={userForm.status} onValueChange={(v) => setUserForm({ ...userForm, status: v as UserStatus })}>
                  <SelectTrigger className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8">
                    <SelectValue placeholder="Choisir un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserStatus.Actif}>Actif</SelectItem>
                    <SelectItem value={UserStatus.Inactif}>Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {user.createdAt && (
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                    <Calendar className="h-3 w-3" />
                    Date d'inscription
                  </Label>
                  <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                    {(() => {
                      const date = new Date(user.createdAt);
                      const day = String(date.getDate()).padStart(2, "0");
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const year = date.getFullYear();
                      const hours = String(date.getHours()).padStart(2, "0");
                      const minutes = String(date.getMinutes()).padStart(2, "0");
                      return `${day}/${month}/${year} ${hours}:${minutes}`;
                    })()}
                  </div>
                </div>
              )}
              {user.lastLogin && (
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                    <Calendar className="h-3 w-3" />
                    Dernière connexion
                  </Label>
                  <div className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 font-mono shadow-sm">
                    {(() => {
                      const date = new Date(user.lastLogin);
                      const day = String(date.getDate()).padStart(2, "0");
                      const month = String(date.getMonth() + 1).padStart(2, "0");
                      const year = date.getFullYear();
                      const hours = String(date.getHours()).padStart(2, "0");
                      const minutes = String(date.getMinutes()).padStart(2, "0");
                      return `${day}/${month}/${year} ${hours}:${minutes}`;
                    })()}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Informations adhérent */}
        {user.adherent && (
          <Card className="shadow-sm hover:shadow-md transition-shadow border-gray-200 dark:border-gray-700 !py-0">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 pb-1.5 pt-1.5 px-2 sm:px-3 gap-0">
              <CardTitle className="flex items-center gap-2 text-xs sm:text-sm">
                <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Informations adhérent</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1.5 px-2 sm:px-3 pb-2 sm:pb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">Civilité</Label>
                  <Select value={adherentForm.civility || "none"} onValueChange={(v) => setAdherentForm({ ...adherentForm, civility: v === "none" ? null : v })}>
                    <SelectTrigger className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      <SelectItem value="Monsieur">Monsieur</SelectItem>
                      <SelectItem value="Madame">Madame</SelectItem>
                      <SelectItem value="Mademoiselle">Mademoiselle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">Prénom</Label>
                  <Input 
                    className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                    value={adherentForm.firstname} 
                    onChange={(e) => setAdherentForm({ ...adherentForm, firstname: e.target.value })} 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">Nom de famille</Label>
                  <Input 
                    className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                    value={adherentForm.lastname} 
                    onChange={(e) => setAdherentForm({ ...adherentForm, lastname: e.target.value })} 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                    <Calendar className="h-3 w-3" />
                    Date de naissance
                  </Label>
                  <Input 
                    className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                    type="date"
                    value={adherentForm.dateNaissance || ""} 
                    onChange={(e) => setAdherentForm({ ...adherentForm, dateNaissance: e.target.value || null })} 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                    <Briefcase className="h-3 w-3" />
                    Type d'adhésion
                  </Label>
                  <Select value={adherentForm.typeAdhesion || "none"} onValueChange={(v) => setAdherentForm({ ...adherentForm, typeAdhesion: v === "none" ? null : v })}>
                    <SelectTrigger className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      <SelectItem value="AdhesionAnnuelle">Adhésion annuelle</SelectItem>
                      <SelectItem value="Renouvellement">Renouvellement</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                    <Briefcase className="h-3 w-3" />
                    Poste
                  </Label>
                  <Select value={adherentForm.posteTemplateId || "none"} onValueChange={(v) => setAdherentForm({ ...adherentForm, posteTemplateId: v === "none" ? null : v })}>
                    <SelectTrigger className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8">
                      <SelectValue placeholder="Sélectionner un poste" />
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
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                    <Briefcase className="h-3 w-3" />
                    Profession
                  </Label>
                  <Input 
                    className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                    value={adherentForm.profession || ""} 
                    onChange={(e) => setAdherentForm({ ...adherentForm, profession: e.target.value || null })} 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                    <Briefcase className="h-3 w-3" />
                    Nombre d'enfants
                  </Label>
                  <Input 
                    className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm h-8"
                    type="number"
                    min="0"
                    value={adherentForm.nombreEnfants} 
                    onChange={(e) => setAdherentForm({ ...adherentForm, nombreEnfants: parseInt(e.target.value) || 0 })} 
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[9px] sm:text-[10px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-t-md">
                    <Briefcase className="h-3 w-3" />
                    Centres d'intérêt
                  </Label>
                  <Textarea 
                    className="p-1.5 sm:p-2 bg-blue-50 dark:bg-slate-800 rounded-md rounded-tl-none border border-blue-200 dark:border-slate-600 border-t-0 text-xs font-medium text-slate-900 dark:text-slate-100 shadow-sm min-h-[60px]"
                    value={adherentForm.centresInteret || ""} 
                    onChange={(e) => setAdherentForm({ ...adherentForm, centresInteret: e.target.value || null })} 
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <div className="flex items-center gap-2 p-1.5 bg-blue-50 dark:bg-slate-800 rounded-md border border-blue-200 dark:border-slate-600">
                    <Checkbox 
                      id="autorisationImage"
                      checked={adherentForm.autorisationImage}
                      onCheckedChange={(checked) => setAdherentForm({ ...adherentForm, autorisationImage: checked === true })}
                    />
                    <Label htmlFor="autorisationImage" className="text-xs font-medium text-slate-900 dark:text-slate-100 cursor-pointer">
                      Autorisation d'utilisation de l'image dans le cadre des activités de l'association
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 p-1.5 bg-blue-50 dark:bg-slate-800 rounded-md border border-blue-200 dark:border-slate-600">
                    <Checkbox 
                      id="accepteCommunications"
                      checked={adherentForm.accepteCommunications}
                      onCheckedChange={(checked) => setAdherentForm({ ...adherentForm, accepteCommunications: checked === true })}
                    />
                    <Label htmlFor="accepteCommunications" className="text-xs font-medium text-slate-900 dark:text-slate-100 cursor-pointer">
                      Acceptation des communications de l'association
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Modal>
  );
}
