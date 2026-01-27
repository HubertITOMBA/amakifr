"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, UserPlus, Mail, Lock, User, Phone, MapPin, Briefcase, Calendar } from "lucide-react";
import { toast } from "sonner";
import { adminCreateAdherent } from "@/actions/user/admin-create-adherent";
import { getAllPostesTemplates } from "@/actions/postes";
import { Civilities, TypeTelephone, TypeAdhesion, UserRole, UserStatus, AdminRole } from "@prisma/client";

type PosteTemplate = {
  id: string;
  code: string;
  libelle: string;
  isActif: boolean;
};

export default function GestionUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [postesTemplates, setPostesTemplates] = useState<PosteTemplate[]>([]);
  const [loadingPostes, setLoadingPostes] = useState(true);

  // États du formulaire
  const [formData, setFormData] = useState({
    // User
    email: "",
    password: "",
    name: "",
    role: UserRole.MEMBRE,
    status: UserStatus.Actif,
    
    // Adherent
    civility: Civilities.Monsieur,
    firstname: "",
    lastname: "",
    dateNaissance: "",
    typeAdhesion: "" as TypeAdhesion | "",
    profession: "",
    anneePromotion: "",
    centresInteret: "",
    autorisationImage: false,
    accepteCommunications: true,
    nombreEnfants: 0,
    
    // Adresse
    streetnum: "",
    street1: "",
    street2: "",
    codepost: "",
    city: "",
    country: "France",
    
    // Téléphone
    telephone: "",
    typeTelephone: TypeTelephone.Mobile,
    
    // Poste
    posteTemplateId: "",
    
    // Rôles d'administration
    adminRoles: [] as AdminRole[],
  });

  // Helper pour déterminer si un profil adhérent est nécessaire
  // RÈGLE: Seuls les utilisateurs avec UserRole.MEMBRE ont droit au profil adhérent
  // Tous les autres rôles (ADMIN, INVITE, PRESID, VICEPR, SECRET, VICESE, COMCPT) n'ont pas de profil adhérent
  const needsAdherentProfile = useMemo(() => {
    return formData.role === UserRole.MEMBRE;
  }, [formData.role]);

  // Charger les postes templates
  useEffect(() => {
    const loadPostes = async () => {
      try {
        const result = await getAllPostesTemplates(true);
        if (result.success && result.data) {
          setPostesTemplates(result.data as PosteTemplate[]);
        }
      } catch (error) {
        console.error("Erreur lors du chargement des postes:", error);
      } finally {
        setLoadingPostes(false);
      }
    };
    loadPostes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation simple
    if (!formData.email) {
      toast.error("L'email est obligatoire");
      return;
    }

    // Les utilisateurs avec role Admin, ADMIN ou Invité n'ont que des données dans la table User
    // Pas besoin de profil adhérent, adresse ou téléphone pour ces rôles
    if (needsAdherentProfile && (!formData.firstname || !formData.lastname)) {
      toast.error("Veuillez remplir tous les champs obligatoires (prénom, nom) pour créer un profil adhérent");
      return;
    }

    setLoading(true);

    try {
      // Créer le FormData
      const formDataToSubmit = new FormData();
      
      // Ajouter tous les champs
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (key === "adminRoles" && Array.isArray(value)) {
            // Pour les rôles, envoyer comme JSON
            formDataToSubmit.append(key, JSON.stringify(value));
          } else {
            formDataToSubmit.append(key, value.toString());
          }
        }
      });

      const result = await adminCreateAdherent(formDataToSubmit);

      if (result.success) {
        toast.success(result.message || "Adhérent créé avec succès");
        router.push("/admin/users");
        router.refresh();
      } else {
        toast.error(result.error || "Erreur lors de la création");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Une erreur s'est produite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      title="Créer un nouvel adhérent" 
      confirmOnClose={false}
      showFooter={false}
      onCancel={() => router.back()}
      className="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section Informations de connexion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-blue-600" />
              Informations de connexion
            </CardTitle>
            <CardDescription>
              Informations nécessaires pour se connecter au portail
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="exemple@email.com"
                  required
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  Nom d'utilisateur
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nom d'utilisateur unique (optionnel)"
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Si vide, l'utilisateur pourra le définir lors de sa première connexion
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" />
                  Mot de passe temporaire
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 6 caractères (optionnel)"
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Si vide, l'utilisateur devra utiliser la réinitialisation de mot de passe
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm font-medium">
                  Rôle
                </Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="role-membre" value={UserRole.MEMBRE}>Membre</SelectItem>
                    <SelectItem key="role-admin" value={UserRole.ADMIN}>Admin</SelectItem>
                    <SelectItem key="role-invite" value={UserRole.INVITE}>Invité</SelectItem>
                    <SelectItem key="role-presid" value={UserRole.PRESID}>Président</SelectItem>
                    <SelectItem key="role-vicepr" value={UserRole.VICEPR}>Vice-Président</SelectItem>
                    <SelectItem key="role-secret" value={UserRole.SECRET}>Secrétaire</SelectItem>
                    <SelectItem key="role-vicese" value={UserRole.VICESE}>Vice-Secrétaire</SelectItem>
                    <SelectItem key="role-comcpt" value={UserRole.COMCPT}>Comptable/Trésorier</SelectItem>
                    <SelectItem key="role-tresor" value={UserRole.TRESOR}>Trésorier</SelectItem>
                    <SelectItem key="role-vtreso" value={UserRole.VTRESO}>Vice-Trésorier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-medium">
                  Statut
                </Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => setFormData({ ...formData, status: value as UserStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="status-actif" value={UserStatus.Actif}>Actif</SelectItem>
                    <SelectItem key="status-inactif" value={UserStatus.Inactif}>Inactif</SelectItem>
                    <SelectItem key="status-suspendu" value={UserStatus.Suspendu}>Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Informations personnelles - Uniquement pour les membres */}
        {/* Les utilisateurs Admin, ADMIN ou Invité n'ont que des données dans la table User */}
        {needsAdherentProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-blue-600" />
              Informations personnelles
            </CardTitle>
            <CardDescription>
              Informations d'identification de l'adhérent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="civility" className="text-sm font-medium">
                  Civilité {needsAdherentProfile && <span className="text-red-500">*</span>}
                </Label>
                <Select 
                  value={formData.civility} 
                  onValueChange={(value) => setFormData({ ...formData, civility: value as Civilities })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="civility-monsieur" value={Civilities.Monsieur}>Monsieur</SelectItem>
                    <SelectItem key="civility-madame" value={Civilities.Madame}>Madame</SelectItem>
                    <SelectItem key="civility-mademoiselle" value={Civilities.Mademoiselle}>Mademoiselle</SelectItem>
                    <SelectItem key="civility-partenaire" value={Civilities.Partenaire}>Partenaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstname" className="text-sm font-medium">
                  Prénom {needsAdherentProfile && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="firstname"
                  type="text"
                  value={formData.firstname}
                  onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                  placeholder="Prénom"
                  required={needsAdherentProfile}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastname" className="text-sm font-medium">
                  Nom {needsAdherentProfile && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="lastname"
                  type="text"
                  value={formData.lastname}
                  onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                  placeholder="Nom"
                  required={needsAdherentProfile}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateNaissance" className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Date de naissance
                </Label>
                <Input
                  id="dateNaissance"
                  type="date"
                  value={formData.dateNaissance}
                  onChange={(e) => setFormData({ ...formData, dateNaissance: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profession" className="text-sm font-medium flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  Profession
                </Label>
                <Input
                  id="profession"
                  type="text"
                  value={formData.profession}
                  onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                  placeholder="Profession"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="anneePromotion" className="text-sm font-medium">
                  Année de promotion Kipaku
                </Label>
                <Input
                  id="anneePromotion"
                  type="text"
                  value={formData.anneePromotion}
                  onChange={(e) => setFormData({ ...formData, anneePromotion: e.target.value })}
                  placeholder="Ex: 2010 ou Non"
                  maxLength={10}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="typeAdhesion" className="text-sm font-medium">
                  Type d'adhésion
                </Label>
                <Select 
                  value={formData.typeAdhesion} 
                  onValueChange={(value) => setFormData({ ...formData, typeAdhesion: value as TypeAdhesion })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="type-adhesion-annuelle" value={TypeAdhesion.AdhesionAnnuelle}>Adhésion annuelle</SelectItem>
                    <SelectItem key="type-renouvellement" value={TypeAdhesion.Renouvellement}>Renouvellement</SelectItem>
                    <SelectItem key="type-autre" value={TypeAdhesion.Autre}>Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombreEnfants" className="text-sm font-medium">
                  Nombre d'enfants
                </Label>
                <Input
                  id="nombreEnfants"
                  type="number"
                  min="0"
                  value={formData.nombreEnfants}
                  onChange={(e) => setFormData({ ...formData, nombreEnfants: parseInt(e.target.value) || 0 })}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="posteTemplateId" className="text-sm font-medium flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  Poste dans l'association
                </Label>
                {loadingPostes ? (
                  <div className="flex items-center justify-center p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <Select 
                    value={formData.posteTemplateId} 
                    onValueChange={(value) => setFormData({ ...formData, posteTemplateId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un poste" />
                    </SelectTrigger>
                    <SelectContent>
                      {postesTemplates.map((poste) => (
                        <SelectItem key={poste.id} value={poste.id}>
                          {poste.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="centresInteret" className="text-sm font-medium">
                Centres d'intérêt
              </Label>
              <Textarea
                id="centresInteret"
                value={formData.centresInteret}
                onChange={(e) => setFormData({ ...formData, centresInteret: e.target.value })}
                placeholder="Centres d'intérêt de l'adhérent..."
                rows={3}
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autorisationImage"
                  checked={formData.autorisationImage}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, autorisationImage: checked as boolean })
                  }
                />
                <Label htmlFor="autorisationImage" className="text-sm font-normal cursor-pointer">
                  Autorisation d'utilisation de l'image
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="accepteCommunications"
                  checked={formData.accepteCommunications}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, accepteCommunications: checked as boolean })
                  }
                />
                <Label htmlFor="accepteCommunications" className="text-sm font-normal cursor-pointer">
                  Accepte de recevoir les communications de l'association
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Section Coordonnées - Uniquement pour les membres */}
        {/* Les utilisateurs Admin, ADMIN ou Invité n'ont que des données dans la table User */}
        {needsAdherentProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-blue-600" />
              Coordonnées
            </CardTitle>
            <CardDescription>
              Adresse et téléphone de l'adhérent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="streetnum" className="text-sm font-medium">
                  Numéro de rue
                </Label>
                <Input
                  id="streetnum"
                  type="text"
                  value={formData.streetnum}
                  onChange={(e) => setFormData({ ...formData, streetnum: e.target.value })}
                  placeholder="Ex: 10"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="street1" className="text-sm font-medium">
                  Rue
                </Label>
                <Input
                  id="street1"
                  type="text"
                  value={formData.street1}
                  onChange={(e) => setFormData({ ...formData, street1: e.target.value })}
                  placeholder="Nom de la rue"
                  className="w-full"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="street2" className="text-sm font-medium">
                  Complément d'adresse
                </Label>
                <Input
                  id="street2"
                  type="text"
                  value={formData.street2}
                  onChange={(e) => setFormData({ ...formData, street2: e.target.value })}
                  placeholder="Bâtiment, appartement, etc."
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="codepost" className="text-sm font-medium">
                  Code postal
                </Label>
                <Input
                  id="codepost"
                  type="text"
                  value={formData.codepost}
                  onChange={(e) => setFormData({ ...formData, codepost: e.target.value })}
                  placeholder="Ex: 75001"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-medium">
                  Ville
                </Label>
                <Input
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Nom de la ville"
                  className="w-full"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="country" className="text-sm font-medium">
                  Pays
                </Label>
                <Input
                  id="country"
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="France"
                  className="w-full"
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telephone" className="text-sm font-medium flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  Téléphone
                </Label>
                <Input
                  id="telephone"
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  placeholder="Ex: 06 12 34 56 78"
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="typeTelephone" className="text-sm font-medium">
                  Type de téléphone
                </Label>
                <Select 
                  value={formData.typeTelephone} 
                  onValueChange={(value) => setFormData({ ...formData, typeTelephone: value as TypeTelephone })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem key="tel-mobile" value={TypeTelephone.Mobile}>Mobile</SelectItem>
                    <SelectItem key="tel-fixe" value={TypeTelephone.Fixe}>Fixe</SelectItem>
                    <SelectItem key="tel-professionnel" value={TypeTelephone.Professionnel}>Professionnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Boutons d'action */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création en cours...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Créer l'adhérent
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
