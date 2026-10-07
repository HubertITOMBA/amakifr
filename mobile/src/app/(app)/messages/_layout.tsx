import { Stack } from "expo-router";
import { AmakiStackHeader } from "@/components/layout/amaki-stack-header";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Messages — header dégradé partagé.
 */
export default function MessagesLayout() {
  return (
    <Stack
      screenOptions={{
        header: (props) => <AmakiStackHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: AmakiColors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Messages" }} />
      <Stack.Screen name="new" options={{ title: "Nouveau message" }} />
      <Stack.Screen name="[id]" options={{ title: "Conversation" }} />
    </Stack>
  );
}
