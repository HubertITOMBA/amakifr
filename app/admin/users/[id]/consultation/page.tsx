"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { getUserByIdForAdmin } from "@/actions/user";
import { UserRole, UserStatus } from "@prisma/client";

const getRoleColor = (role: UserRole) => {
  switch (role) {
    case UserRole.Admin:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case UserRole.Membre:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case UserRole.Invite:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getRoleLabel = (role: UserRole) => {
  switch (role) {
    case UserRole.Admin:
      return "Admin";
    case UserRole.Membre:
      return "Membre";
    case UserRole.Invite:
      return "Invité";
    default:
      return role;
  }
};

const getStatusColor = (status: UserStatus) => {
  switch (status) {
    case UserStatus.Actif:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case UserStatus.Inactif:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatusLabel = (status: UserStatus) => {
  switch (status) {
    case UserStatus.Actif:
      return "Actif";
    case UserStatus.Inactif:
      return "Inactif";
    default:
      return status;
  }
};

export default function ConsultationUserPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadUser();
    }
  }, [id]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const result = await getUserByIdForAdmin(id);
      if (result.success && result.user) {
        setUser(result.user);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Modal title="Détails de l'utilisateur" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!user) {
    return (
      <Modal title="Détails de l'utilisateur" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Utilisateur introuvable
        </div>
      </Modal>
    );
  }

  const fullName = user.adherent 
    ? `${user.adherent.civility || ''} ${user.adherent.firstname || ''} ${user.adherent.lastname || ''}`.trim()
    : user.name || "Sans nom";

  const adresse = user.adherent?.Adresse?.[0];

  return (
    <Modal title="Détails de l'utilisateur" confirmOnClose={false}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nom complet</Label>
            <div className="text-sm mt-1">{fullName}</div>
          </div>
          <div>
            <Label>Email</Label>
            <div className="text-sm mt-1">{user.email || "—"}</div>
          </div>
          <div>
            <Label>Rôle</Label>
            <div className="text-sm mt-1">
              <Badge className={`${getRoleColor(user.role)} text-xs`}>
                {getRoleLabel(user.role)}
              </Badge>
            </div>
          </div>
          <div>
            <Label>Statut</Label>
            <div className="text-sm mt-1">
              <Badge className={`${getStatusColor(user.status)} text-xs`}>
                {getStatusLabel(user.status)}
              </Badge>
            </div>
          </div>
          {user.adherent && (
            <>
              {user.adherent.Telephones && user.adherent.Telephones.length > 0 && (
                <div>
                  <Label>Téléphones</Label>
                  <div className="text-sm mt-1">
                    {user.adherent.Telephones.map((tel: any, idx: number) => (
                      <div key={idx}>
                        {tel.numero} ({tel.type})
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {adresse && (
                <>
                  {adresse.street1 && (
                    <div>
                      <Label>Adresse</Label>
                      <div className="text-sm mt-1">
                        {adresse.streetnum && `${adresse.streetnum} `}
                        {adresse.street1}
                        {adresse.street2 && ` ${adresse.street2}`}
                      </div>
                    </div>
                  )}
                  {(adresse.codepost || adresse.city) && (
                    <div>
                      <Label>Ville</Label>
                      <div className="text-sm mt-1">
                        {adresse.codepost} {adresse.city}
                        {adresse.country && `, ${adresse.country}`}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {user.createdAt && (
            <div>
              <Label>Date d'inscription</Label>
              <div className="text-sm mt-1">{new Date(user.createdAt).toLocaleDateString("fr-FR")}</div>
            </div>
          )}
          {user.lastLogin && (
            <div>
              <Label>Dernière connexion</Label>
              <div className="text-sm mt-1">{new Date(user.lastLogin).toLocaleDateString("fr-FR")}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

