import { Stack } from "expo-router";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Profil — hub + sections lazy (hors bottom tabs).
 */
export default function ProfilLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: AmakiColors.primary },
        headerTintColor: AmakiColors.surface,
        headerTitleStyle: { fontWeight: "600" },
        headerBackTitle: "Profil",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="compte" options={{ title: "Mon compte" }} />
      <Stack.Screen name="identite" options={{ title: "Identité" }} />
      <Stack.Screen name="coordonnees" options={{ title: "Mes coordonnées" }} />
      <Stack.Screen name="contact" options={{ title: "Contact" }} />
    </Stack>
  );
}
