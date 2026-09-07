import { Stack } from "expo-router";
import { AmakiColors } from "@/constants/theme";

/**
 * Stack Messages.
 */
export default function MessagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: AmakiColors.primary },
        headerTintColor: AmakiColors.surface,
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Messages" }} />
      <Stack.Screen name="new" options={{ title: "Nouveau message" }} />
      <Stack.Screen name="[id]" options={{ title: "Conversation" }} />
    </Stack>
  );
}
