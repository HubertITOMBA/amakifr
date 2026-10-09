import { Stack } from "expo-router";
import { AmakiStackHeader } from "@/components/layout/amaki-stack-header";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Réunions — header dégradé partagé (liste + lecteur compte rendu).
 */
export default function ReunionsLayout() {
  return (
    <Stack
      screenOptions={{
        header: (props) => <AmakiStackHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: AmakiColors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Les réunions" }} />
      <Stack.Screen
        name="rapport/[id]"
        options={{ title: "Compte rendu" }}
      />
    </Stack>
  );
}
