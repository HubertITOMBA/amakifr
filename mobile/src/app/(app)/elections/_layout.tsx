import { Stack } from "expo-router";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Élections / Vote.
 */
export default function ElectionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: AmakiColors.primary },
        headerTintColor: AmakiColors.surface,
        headerTitleStyle: { fontWeight: "600" },
        contentStyle: { backgroundColor: AmakiColors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Élections" }} />
      <Stack.Screen name="[id]" options={{ title: "Scrutin" }} />
    </Stack>
  );
}
