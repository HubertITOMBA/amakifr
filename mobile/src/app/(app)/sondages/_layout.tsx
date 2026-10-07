import { Stack } from "expo-router";
import { AmakiStackHeader } from "@/components/layout/amaki-stack-header";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Sondages — header dégradé partagé.
 */
export default function SondagesLayout() {
  return (
    <Stack
      screenOptions={{
        header: (props) => <AmakiStackHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: AmakiColors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mes sondages" }} />
      <Stack.Screen name="[id]" options={{ title: "Questionnaire" }} />
    </Stack>
  );
}
