import { Stack } from "expo-router";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Mes sondages + questionnaire.
 */
export default function SondagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: AmakiColors.primary },
        headerTintColor: AmakiColors.surface,
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mes sondages" }} />
      <Stack.Screen name="[id]" options={{ title: "Questionnaire" }} />
    </Stack>
  );
}
