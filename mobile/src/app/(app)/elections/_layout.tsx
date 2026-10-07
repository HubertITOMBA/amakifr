import { Stack } from "expo-router";
import { AmakiStackHeader } from "@/components/layout/amaki-stack-header";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Élections — header dégradé partagé.
 */
export default function ElectionsLayout() {
  return (
    <Stack
      screenOptions={{
        header: (props) => <AmakiStackHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: AmakiColors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Élections" }} />
      <Stack.Screen name="[id]" options={{ title: "Scrutin" }} />
    </Stack>
  );
}
