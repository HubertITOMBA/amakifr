import { Stack } from "expo-router";
import { AmakiStackHeader } from "@/components/layout/amaki-stack-header";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Événements — header dégradé partagé.
 */
export default function EvenementsLayout() {
  return (
    <Stack
      screenOptions={{
        header: (props) => <AmakiStackHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: AmakiColors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Événements" }} />
      <Stack.Screen name="[id]" options={{ title: "Détail" }} />
    </Stack>
  );
}
