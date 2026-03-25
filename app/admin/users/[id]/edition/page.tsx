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
import { getUserByIdForAdmin, adminUpdateUserRole, adminUpdateUserStatus } from "@/actions/user";
import { adminResetUserPassword } from "@/actions/user/admin-reset-password";
import { getAllPostesTemplates } from "@/actions/postes";
import { UserRole, UserStatus } from "@prisma/client";
import { toast } from "react-toastify";
import { User, Mail, Calendar, Briefcase, Shield, MapPin, Phone, KeyRound, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountryAutocomplete } from "@/components/forms/country-autocomplete";
import { CityAutocomplete } from "@/components/forms/city-autocomplete";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import type { AddressResult } from "@/actions/location/search-address";
import { adminUpdateUserData } from "@/actions/user/admin-update-user-data";
import { PhotoUpload } from "@/components/ui/photo-upload";

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toggleEvenementFamilial = (current: string[], type: string) => {
  if (current.includes(type)) return current.filter((t) => t !== type);
  return [...current, type];
};

export default function EditionUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [isDirty, setIsDirty] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [postes, setPostes] = useState<any[]>([]);
  const [resettingPassword, setResettingPassword] = useState(false);
  
  const [userForm, setUserForm] = useState<{ name: string; email: string; role: UserRole; status: UserStatus; image: string }>({
    name: "",
    email: "",
    role: UserRole.MEMBRE,
    status: UserStatus.Inactif,
    image: "",
  });
  
  const [adherentForm, setAdherentForm] = useState<{
    civility: string | null;
    firstname: string;
    lastname: string;
    dateNaissance: string | null;
    datePremiereAdhesion: string | null;
    typeAdhesion: string | null;
    profession: string | null;
    centresInteret: string | null;
    autorisationImage: boolean;
    accepteCommunications: boolean;
    nombreEnfants: number;
    evenementsFamiliaux: string[];
    posteTemplateId: string | null;
  }>({
    civility: null,
    firstname: "",
    lastname: "",
    dateNaissance: null,
    datePremiereAdhesion: null,
    typeAdhesion: null,
    profession: null,
    centresInteret: null,
    autorisationImage: false,
    accepteCommunications: true,
    nombreEnfants: 0,
    evenementsFamiliaux: [],
    posteTemplateId: null,
  });

  const [adresseData, setAdresseData] = useState<{
    streetnum?: string;
    street1?: string;
    street2?: string;
    codepost?: string;
    city?: string;
    country?: string;
  }>({
    streetnum: "",
    street1: "",
    street2: "",
    codepost: "",
    city: "",
    country: "France",
  });

  const [telephonesData, setTelephonesData] = useState<
    Array<{ numero: string; type: "Mobile" | "Fixe" | "Professionnel"; estPrincipal: boolean; description?: string }>
  >([]);

  const [enfantsData, setEnfantsData] = useState<Array<{ prenom: string; dateNaissance?: string; age?: number }>>([]);

  const [countryCode, setCountryCode] = useState<string>("FR");

  const handleAddressChange = (address: AddressResult | null) => {
    if (!address) {
      setAdresseData((prev) => ({ ...prev, street1: "", codepost: "", city: "" }));
      return;
    }
    const isFreeText = !address.id || address.id.startsWith("free-text-");
    if (isFreeText) {
      setAdresseData((prev) => ({ ...prev, street1: address.street || address.label || "" }));
      return;
    }
    const isFrenchPostcode = address.postcode && /^\d{5}$/.test(address.postcode);
    if (isFrenchPostcode) setCountryCode("FR");
    setAdresseData((prev) => ({
      ...prev,
      streetnum: address.housenumber || "",
      street1: address.street || (address.label.split(",")[0] || ""),
      codepost: address.postcode || "",
      city: address.city || "",
      country: isFrenchPostcode ? "France" : prev.country,
    }));
  };
  
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
    const adresseChanged = JSON.stringify(adresseData) !== JSON.stringify(user?.adherent?.Adresse?.[0] || {});
    const telephonesChanged = JSON.stringify(telephonesData) !== JSON.stringify((user?.adherent?.Telephones || []).map((t: any) => ({
      numero: t.numero,
      type: t.type,
      estPrincipal: t.estPrincipal,
      description: t.description || "",
    })));
    const enfantsChanged = JSON.stringify(enfantsData) !== JSON.stringify((user?.adherent?.Enfants || []).map((e: any) => ({
      prenom: e.prenom,
      dateNaissance: e.dateNaissance ? formatDate(e.dateNaissance) : "",
      age: e.age || undefined,
    })));
    setIsDirty(userChanged || adherentChanged || adresseChanged || telephonesChanged || enfantsChanged);
  }, [userForm, adherentForm, adresseData, telephonesData, enfantsData, initialUserForm, initialAdherentForm, user]);

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
            datePremiereAdhesion: adherent.datePremiereAdhesion ? formatDate(adherent.datePremiereAdhesion) : null,
            typeAdhesion: adherent.typeAdhesion || null,
            profession: adherent.profession || null,
            centresInteret: adherent.centresInteret || null,
            autorisationImage: adherent.autorisationImage || false,
            accepteCommunications: adherent.accepteCommunications !== false,
            nombreEnfants: adherent.nombreEnfants || 0,
            evenementsFamiliaux: adherent.evenementsFamiliaux ? JSON.parse(adherent.evenementsFamiliaux) : [],
            posteTemplateId: adherent.PosteTemplate?.id || null,
          };
          setAdherentForm(adherentInit);
          setInitialAdherentForm(adherentInit);

          const adr = adherent.Adresse?.[0];
          if (adr) {
            setAdresseData({
              streetnum: adr.streetnum || "",
              street1: adr.street1 || "",
              street2: adr.street2 || "",
              codepost: adr.codepost || "",
              city: adr.city || "",
              country: adr.country || "France",
            });
          }

          if (adherent.Telephones && adherent.Telephones.length > 0) {
            setTelephonesData(
              adherent.Telephones.map((t: any) => ({
                numero: t.numero,
                type: t.type,
                estPrincipal: t.estPrincipal,
                description: t.description || "",
              }))
            );
          } else {
            setTelephonesData([]);
          }

          if (adherent.Enfants && adherent.Enfants.length > 0) {
            setEnfantsData(
              adherent.Enfants.map((e: any) => ({
                prenom: e.prenom,
                dateNaissance: e.dateNaissance ? formatDate(e.dateNaissance) : "",
                age: e.age || undefined,
              }))
            );
          } else {
            setEnfantsData([]);
          }
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

      // Mettre à jour le profil complet (mêmes rubriques que /user/update)
      const resProfile = await adminUpdateUserData({
        userId: user.id,
        userData: {
          name: userForm.name,
          email: userForm.email,
          image: userForm.image || null,
        },
        adherentData: {
          civility: adherentForm.civility,
          firstname: adherentForm.firstname,
          lastname: adherentForm.lastname,
          dateNaissance: adherentForm.dateNaissance || null,
          datePremiereAdhesion: adherentForm.datePremiereAdhesion || null,
          typeAdhesion: adherentForm.typeAdhesion as any,
          profession: adherentForm.profession || null,
          centresInteret: adherentForm.centresInteret || null,
          autorisationImage: adherentForm.autorisationImage,
          accepteCommunications: adherentForm.accepteCommunications,
          nombreEnfants: adherentForm.nombreEnfants,
          evenementsFamiliaux: adherentForm.evenementsFamiliaux || [],
          posteTemplateId: adherentForm.posteTemplateId || null,
        },
        adresseData,
        telephonesData,
        enfantsData,
      });

      if (!resProfile.success) {
        toast.error(resProfile.error || "Erreur lors de la mise à jour du profil");
        return;
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

  const handleResetPassword = async () => {
    if (!user || !user.id) return;
    
    // Confirmation avant de réinitialiser
    if (!confirm("Êtes-vous sûr de vouloir réinitialiser le mot de passe de cet utilisateur ? Un nouveau mot de passe sera généré et envoyé par email.")) {
      return;
    }

    setResettingPassword(true);
    try {
      console.log("[handleResetPassword] Début de la réinitialisation du mot de passe pour l'utilisateur:", user.id);
      const result = await adminResetUserPassword(user.id);
      console.log("[handleResetPassword] Résultat:", result);
      
      if (result.success) {
        toast.success(result.message || "Le mot de passe a été réinitialisé et envoyé par email");
      } else {
        console.error("[handleResetPassword] Erreur retournée:", result.error);
        toast.error(result.error || "Erreur lors de la réinitialisation du mot de passe");
      }
    } catch (error: any) {
      console.error("[handleResetPassword] Exception lors de la réinitialisation du mot de passe:", error);
      toast.error(`Une erreur s'est produite lors de la réinitialisation du mot de passe: ${error?.message || "Erreur inconnue"}`);
    } finally {
      setResettingPassword(false);
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
        {/* Photo de profil (aligné /user/update) */}
        <Card className="!py-0 shadow-xl border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Photo de profil
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 flex justify-center">
            <PhotoUpload
              currentImage={userForm.image || ""}
              userName={userForm.name || fullName}
              onImageChange={(url) => setUserForm((prev) => ({ ...prev, image: url }))}
              size="md"
            />
          </CardContent>
        </Card>

        {/* 1. Informations personnelles (aligné /user/update) */}
        <Card className="!py-0 shadow-xl border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              1. Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Civilité</Label>
                <Select
                  value={adherentForm.civility || "Monsieur"}
                  onValueChange={(value) => setAdherentForm((prev) => ({ ...prev, civility: value }))}
                >
                  <SelectTrigger className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Sélectionner une civilité" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monsieur">Monsieur</SelectItem>
                    <SelectItem value="Madame">Madame</SelectItem>
                    <SelectItem value="Mademoiselle">Mademoiselle</SelectItem>
                    <SelectItem value="Partenaire">Partenaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Prénom</Label>
                <Input
                  value={adherentForm.firstname}
                  onChange={(e) => setAdherentForm((prev) => ({ ...prev, firstname: e.target.value }))}
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Nom de famille</Label>
                <Input
                  value={adherentForm.lastname}
                  onChange={(e) => setAdherentForm((prev) => ({ ...prev, lastname: e.target.value }))}
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Date de naissance</Label>
                <Input
                  type="date"
                  value={adherentForm.dateNaissance || ""}
                  onChange={(e) => setAdherentForm((prev) => ({ ...prev, dateNaissance: e.target.value || null }))}
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Date de première adhésion <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(optionnel)</span>
                </Label>
                <Input
                  type="date"
                  value={adherentForm.datePremiereAdhesion || ""}
                  onChange={(e) => setAdherentForm((prev) => ({ ...prev, datePremiereAdhesion: e.target.value || null }))}
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Si ancien adhérent, renseigner la date de première adhésion pour la logique des frais d&apos;adhésion.
                </p>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">E-mail</Label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Nom d&apos;affichage</Label>
                <Input
                  value={userForm.name}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Poste</Label>
                <Select
                  value={adherentForm.posteTemplateId || "none"}
                  onValueChange={(v) => setAdherentForm((prev) => ({ ...prev, posteTemplateId: v === "none" ? null : v }))}
                >
                  <SelectTrigger className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
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
            </div>
          </CardContent>
        </Card>

        {/* Administration (rôle/statut/reset mdp) */}
        <Card className="!py-0 shadow-xl border-slate-200 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-700 dark:to-slate-800 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" />
              Administration
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rôle</Label>
                <Select value={userForm.role} onValueChange={(v) => setUserForm((prev) => ({ ...prev, role: v as UserRole }))}>
                  <SelectTrigger className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Choisir un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                    <SelectItem value={UserRole.MEMBRE}>Membre</SelectItem>
                    <SelectItem value={UserRole.INVITE}>Invité</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Statut</Label>
                <Select value={userForm.status} onValueChange={(v) => setUserForm((prev) => ({ ...prev, status: v as UserStatus }))}>
                  <SelectTrigger className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Choisir un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserStatus.Actif}>Actif</SelectItem>
                    <SelectItem value={UserStatus.Inactif}>Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {user.createdAt ? <>Inscription : {new Date(user.createdAt).toLocaleString("fr-FR")}</> : null}
                {user.lastLogin ? <> • Dernière connexion : {new Date(user.lastLogin).toLocaleString("fr-FR")}</> : null}
              </div>
              <Button
                type="button"
                onClick={handleResetPassword}
                disabled={resettingPassword}
                variant="outline"
                className="border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-700 dark:text-orange-400"
              >
                {resettingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Réinitialisation...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Réinitialiser le mot de passe
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Adresse (aligné /user/update) */}
        {user.adherent && (
          <Card className="!py-0 shadow-xl border-green-200 dark:border-green-800">
            <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                Adresse
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Numéro de rue</Label>
                  <Input
                    value={adresseData.streetnum || ""}
                    onChange={(e) => setAdresseData((prev) => ({ ...prev, streetnum: e.target.value }))}
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="relative z-[15]">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Rue</Label>
                  <AddressAutocomplete
                    value={adresseData.street1 || ""}
                    onValueChange={handleAddressChange}
                    placeholder="Tapez une rue (ex: rue de la Paix, Paris)"
                    disabled={false}
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Complément d'adresse</Label>
                  <Input
                    value={adresseData.street2 || ""}
                    onChange={(e) => setAdresseData((prev) => ({ ...prev, street2: e.target.value }))}
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Code postal</Label>
                  <Input
                    value={adresseData.codepost || ""}
                    onChange={(e) => setAdresseData((prev) => ({ ...prev, codepost: e.target.value }))}
                    className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="relative z-[10]">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Ville</Label>
                  <CityAutocomplete
                    value={adresseData.city || ""}
                    onValueChange={(v) => setAdresseData((prev) => ({ ...prev, city: v }))}
                    countryCode={countryCode}
                    placeholder="Sélectionner une ville..."
                    disabled={!countryCode}
                  />
                </div>
                <div className="relative z-[5]">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Pays</Label>
                  <CountryAutocomplete
                    value={adresseData.country || ""}
                    onValueChange={(v) => setAdresseData((prev) => ({ ...prev, country: v, city: "" }))}
                    onCountryCodeChange={(code) => setCountryCode(code)}
                    placeholder="Sélectionner un pays..."
                    disabled={false}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Téléphones */}
        {user.adherent && (
          <Card className="!py-0 shadow-xl border-purple-200 dark:border-purple-800">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Phone className="h-5 w-5" />
                Téléphones
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              {telephonesData.map((telephone, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white">Téléphone {index + 1}</h4>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 font-medium">
                        <input
                          type="checkbox"
                          checked={telephone.estPrincipal}
                          onChange={(e) =>
                            setTelephonesData((prev) =>
                              prev.map((t, i) => ({ ...t, estPrincipal: i === index ? e.target.checked : false }))
                            )
                          }
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        Principal
                      </label>
                      {telephonesData.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setTelephonesData((prev) => prev.filter((_, i) => i !== index))}
                          className="text-red-600 hover:text-red-800"
                        >
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Numéro</Label>
                      <Input
                        value={telephone.numero}
                        onChange={(e) =>
                          setTelephonesData((prev) => prev.map((t, i) => (i === index ? { ...t, numero: e.target.value } : t)))
                        }
                        className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Type</Label>
                      <Select
                        value={telephone.type}
                        onValueChange={(value) =>
                          setTelephonesData((prev) => prev.map((t, i) => (i === index ? { ...t, type: value as any } : t)))
                        }
                      >
                        <SelectTrigger className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mobile">Mobile</SelectItem>
                          <SelectItem value="Fixe">Fixe</SelectItem>
                          <SelectItem value="Professionnel">Professionnel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Description (optionnel)</Label>
                    <Input
                      value={telephone.description || ""}
                      onChange={(e) =>
                        setTelephonesData((prev) =>
                          prev.map((t, i) => (i === index ? { ...t, description: e.target.value } : t))
                        )
                      }
                      className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setTelephonesData((prev) => [
                    ...prev,
                    { numero: "", type: "Mobile", estPrincipal: prev.length === 0, description: "" },
                  ])
                }
                className="w-full flex items-center gap-2 border-purple-300 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                Ajouter un téléphone
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 2. Type d'adhésion (aligné /user/update) */}
        {user.adherent && (
          <Card className="!py-0 shadow-xl border-orange-200 dark:border-orange-800">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                2. Type d&apos;adhésion
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Type d&apos;adhésion</Label>
                <Select
                  value={adherentForm.typeAdhesion || ""}
                  onValueChange={(value) => setAdherentForm((prev) => ({ ...prev, typeAdhesion: value }))}
                >
                  <SelectTrigger className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                    <SelectValue placeholder="Sélectionner un type d'adhésion" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AdhesionAnnuelle">Adhésion annuelle</SelectItem>
                    <SelectItem value="Renouvellement">Renouvellement</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informations familiales (enfants + événements familiaux) */}
        {user.adherent && (
          <Card className="!py-0 shadow-xl border-pink-200 dark:border-pink-800">
            <CardHeader className="bg-gradient-to-r from-pink-500 to-pink-600 dark:from-pink-600 dark:to-pink-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Informations familiales
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Nombre d'enfants</Label>
                <Input
                  type="number"
                  min="0"
                  value={adherentForm.nombreEnfants}
                  onChange={(e) => setAdherentForm((prev) => ({ ...prev, nombreEnfants: parseInt(e.target.value) || 0 }))}
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Enfants</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEnfantsData((prev) => [...prev, { prenom: "", dateNaissance: "", age: undefined }])}
                  >
                    Ajouter
                  </Button>
                </div>
                {enfantsData.map((enfant, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-900 dark:text-white">Enfant {index + 1}</div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setEnfantsData((prev) => prev.filter((_, i) => i !== index))}>
                        Supprimer
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Prénom</Label>
                        <Input
                          value={enfant.prenom}
                          onChange={(e) => setEnfantsData((prev) => prev.map((x, i) => (i === index ? { ...x, prenom: e.target.value } : x)))}
                          className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Date de naissance</Label>
                        <Input
                          type="date"
                          value={enfant.dateNaissance || ""}
                          onChange={(e) =>
                            setEnfantsData((prev) => prev.map((x, i) => (i === index ? { ...x, dateNaissance: e.target.value } : x)))
                          }
                          className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Âge</Label>
                        <Input
                          type="number"
                          min="0"
                          value={enfant.age || ""}
                          onChange={(e) =>
                            setEnfantsData((prev) =>
                              prev.map((x, i) => (i === index ? { ...x, age: parseInt(e.target.value) || undefined } : x))
                            )
                          }
                          className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Événements familiaux nécessitant l'assistance</Label>
                {["Naissance", "MariageEnfant", "DecesFamille", "AnniversaireSalle", "Autre"].map((k) => (
                  <div key={k} className="flex items-center space-x-2">
                    <Checkbox
                      id={`evt-${k}`}
                      checked={adherentForm.evenementsFamiliaux.includes(k)}
                      onCheckedChange={() =>
                        setAdherentForm((prev) => ({ ...prev, evenementsFamiliaux: toggleEvenementFamilial(prev.evenementsFamiliaux, k) }))
                      }
                    />
                    <Label htmlFor={`evt-${k}`} className="font-normal cursor-pointer text-gray-700 dark:text-gray-200">
                      {k === "MariageEnfant"
                        ? "Mariage d'un enfant"
                        : k === "DecesFamille"
                          ? "Décès dans la famille"
                          : k === "AnniversaireSalle"
                            ? "Anniversaire organisé en salle"
                            : k}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 4. Informations complémentaires (aligné /user/update) */}
        {user.adherent && (
          <Card className="!py-0 shadow-xl border-indigo-200 dark:border-indigo-800">
            <CardHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5" />
                4. Informations complémentaires
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Profession (optionnel)</Label>
                <Input
                  value={adherentForm.profession || ""}
                  onChange={(e) => setAdherentForm((prev) => ({ ...prev, profession: e.target.value }))}
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Centres d&apos;intérêt</Label>
                <Textarea
                  value={adherentForm.centresInteret || ""}
                  onChange={(e) => setAdherentForm((prev) => ({ ...prev, centresInteret: e.target.value }))}
                  rows={4}
                  className="mt-1 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 5. Autorisations (aligné /user/update) */}
        {user.adherent && (
          <Card className="!py-0 shadow-xl border-teal-200 dark:border-teal-800">
            <CardHeader className="bg-gradient-to-r from-teal-500 to-teal-600 dark:from-teal-600 dark:to-teal-700 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                5. Autorisations
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autorisation-image"
                  checked={adherentForm.autorisationImage}
                  onCheckedChange={(checked) => setAdherentForm((prev) => ({ ...prev, autorisationImage: checked === true }))}
                />
                <Label htmlFor="autorisation-image" className="font-normal cursor-pointer text-gray-700 dark:text-gray-200">
                  J&apos;autorise l&apos;association à utiliser mon image dans le cadre de ses activités.
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="accepte-communications"
                  checked={adherentForm.accepteCommunications}
                  onCheckedChange={(checked) => setAdherentForm((prev) => ({ ...prev, accepteCommunications: checked === true }))}
                />
                <Label htmlFor="accepte-communications" className="font-normal cursor-pointer text-gray-700 dark:text-gray-200">
                  J&apos;accepte de recevoir les communications de l&apos;association.
                </Label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mention RGPD (aligné /user/update) */}
        {user.adherent && (
          <Card className="border-2 border-blue-300 dark:border-blue-600 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-blue-900/20 shadow-lg !py-0">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Info className="h-5 w-5" />
                </div>
                <span>Mention d&apos;information RGPD</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 px-4 sm:px-6">
              <p className="text-xs sm:text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                Les informations recueillies sur ce formulaire sont enregistrées par l&apos;association afin de gérer les
                adhésions et d&apos;assurer l&apos;assistance prévue dans les statuts, notamment lors des événements familiaux
                (naissance, mariage d&apos;un enfant, décès, anniversaire). Les données collectées sont limitées à ce qui est
                strictement nécessaire. Elles sont destinées exclusivement aux membres du bureau de l&apos;association et ne
                seront jamais transmises à des tiers sans votre accord. Vous pouvez exercer votre droit d&apos;accès, de
                rectification ou de suppression de vos données en contactant l&apos;association.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Modal>
  );
}
