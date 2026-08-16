import { Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/auth/auth-context";

function RootNavigator() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#1d4ed8" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === "authenticated"}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status !== "authenticated"}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

/**
 * Layout racine — AuthProvider + Protected Routes Expo Router.
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
});
