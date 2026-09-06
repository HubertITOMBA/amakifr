import { useCallback } from "react";
import {
  getMyProfileSection,
  type MeProfileIdentityDto,
} from "@/api/profile";
import { Card } from "@/components/ui/card";
import {
  ProfileInfoRow,
  ProfileSectionScreen,
} from "@/components/profil/profile-section-screen";
import { formatDateFr } from "@/utils/profile-helpers";

/**
 * Section Identité — chargée au clic uniquement.
 */
export default function ProfilIdentiteScreen() {
  const load = useCallback(
    () => getMyProfileSection<MeProfileIdentityDto>("identity"),
    []
  );

  return (
    <ProfileSectionScreen
      load={load}
      emptyMessage="Informations d'identité non disponibles"
    >
      {(data) => (
        <Card>
          <ProfileInfoRow label="Civilité" value={data.civility ?? "—"} />
          <ProfileInfoRow label="Prénom" value={data.firstname ?? "—"} />
          <ProfileInfoRow label="Nom" value={data.lastname ?? "—"} />
          <ProfileInfoRow
            label="Date de naissance"
            value={formatDateFr(data.dateNaissance)}
          />
          <ProfileInfoRow
            label="N° passeport"
            value={data.numeroPasseport ?? "—"}
            last
          />
        </Card>
      )}
    </ProfileSectionScreen>
  );
}
