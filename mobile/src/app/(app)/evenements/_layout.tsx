import { Stack } from "expo-router";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Événements (hors bottom tabs).
 */
export default function EvenementsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: AmakiColors.primary },
        headerTintColor: AmakiColors.surface,
        headerTitleStyle: { fontWeight: "600" },
        headerBackTitle: "Événements",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Événements" }} />
      <Stack.Screen name="[id]" options={{ title: "Détail" }} />
    </Stack>
  );
}
