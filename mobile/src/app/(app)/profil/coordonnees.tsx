import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  getMyProfileSection,
  type MeProfileCoordonneesDto,
} from "@/api/profile";
import { Card } from "@/components/ui/card";
import { ProfileSectionScreen } from "@/components/profil/profile-section-screen";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";
import { formatAddress } from "@/utils/profile-helpers";

/**
 * Section Mes coordonnées (adresses) — chargée au clic.
 */
export default function ProfilCoordonneesScreen() {
  const load = useCallback(
    () => getMyProfileSection<MeProfileCoordonneesDto>("coordonnees"),
    []
  );

  return (
    <ProfileSectionScreen load={load} emptyMessage="Aucune adresse">
      {(data) =>
        data.addresses.length === 0 ? (
          <Text style={styles.empty}>Aucune adresse renseignée</Text>
        ) : (
          <View style={styles.list}>
            {data.addresses.map((addr) => {
              const lines = formatAddress(addr);
              if (lines.length === 0) return null;
              return (
                <Card key={addr.id} style={styles.card}>
                  {lines.map((line, i) => (
                    <Text key={i} style={styles.line}>
                      {line}
                    </Text>
                  ))}
                </Card>
              );
            })}
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
  line: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    lineHeight: 24,
  },
  empty: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
  },
});
