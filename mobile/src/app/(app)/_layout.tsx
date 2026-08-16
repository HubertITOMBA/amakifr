import { Stack } from "expo-router";

/**
 * Zone authentifiée.
 */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1d4ed8" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "600" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Mon profil" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
    </Stack>
  );
}
