import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  getMyProfileSection,
  type MeProfileContactDto,
} from "@/api/profile";
import { Card } from "@/components/ui/card";
import {
  ProfileInfoRow,
  ProfileSectionScreen,
} from "@/components/profil/profile-section-screen";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Section Contact = téléphones adhérent (pas d'urgence distincte en modèle).
 */
export default function ProfilContactScreen() {
  const load = useCallback(
    () => getMyProfileSection<MeProfileContactDto>("contact"),
    []
  );

  return (
    <ProfileSectionScreen load={load} emptyMessage="Aucun téléphone">
      {(data) =>
        data.telephones.length === 0 ? (
          <Text style={styles.empty}>Aucun téléphone renseigné</Text>
        ) : (
          <View style={styles.list}>
            {data.telephones.map((phone, index) => (
              <Card key={phone.id} style={styles.card}>
                <ProfileInfoRow label="Numéro" value={phone.numero} />
                <ProfileInfoRow label="Type" value={phone.type} />
                <ProfileInfoRow
                  label="Principal"
                  value={phone.estPrincipal ? "Oui" : "Non"}
                  last={!phone.description}
                />
                {phone.description ? (
                  <ProfileInfoRow
                    label="Description"
                    value={phone.description}
                    last
                  />
                ) : null}
                {index < data.telephones.length - 1 ? null : null}
              </Card>
            ))}
          </View>
        )
      }
    </ProfileSectionScreen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: AmakiSpacing.sm,
  },
  card: {
    marginBottom: AmakiSpacing.sm,
  },
  empty: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
  },
});
