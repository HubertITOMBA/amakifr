import { useCallback } from "react";
import {
  getMyProfileSection,
  type MeProfileAccountDto,
} from "@/api/profile";
import { Card } from "@/components/ui/card";
import {
  ProfileInfoRow,
  ProfileSectionScreen,
} from "@/components/profil/profile-section-screen";
import { formatDateTimeFr } from "@/utils/profile-helpers";

/**
 * Section Mon compte — chargée au clic uniquement.
 */
export default function ProfilCompteScreen() {
  const load = useCallback(
    () => getMyProfileSection<MeProfileAccountDto>("account"),
    []
  );

  return (
    <ProfileSectionScreen load={load}>
      {(data) => (
        <Card>
          <ProfileInfoRow label="E-mail" value={data.email ?? "—"} />
          <ProfileInfoRow label="Rôle" value={data.role} />
          <ProfileInfoRow label="Statut" value={data.status} />
          <ProfileInfoRow
            label="Dernière connexion"
            value={formatDateTimeFr(data.lastLogin)}
            last
          />
        </Card>
      )}
    </ProfileSectionScreen>
  );
}
