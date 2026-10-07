import { Stack } from "expo-router";
import { AmakiStackHeader } from "@/components/layout/amaki-stack-header";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Profil — hub sans header Stack ; sous-écrans dégradé partagé.
 */
export default function ProfilLayout() {
  return (
    <Stack
      screenOptions={{
        header: (props) => <AmakiStackHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: AmakiColors.background },
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
