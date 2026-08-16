import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/auth/auth-context";
import { ApiClientError } from "@/api/types";

/**
 * Écran /me minimal — GET /api/v1/me + déconnexion.
 */
export default function MeScreen() {
  const { user, refreshMe, signOut } = useAuth();
  const [loading, setLoading] = useState(!user);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await refreshMe();
    } catch (e) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError("Impossible de charger le profil");
      }
    } finally {
      setLoading(false);
    }
  }, [refreshMe]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  if (loading && !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.field}>
        <Text style={styles.label}>Nom</Text>
        <Text style={styles.value}>{user?.name ?? "—"}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>E-mail</Text>
        <Text style={styles.value}>{user?.email ?? "—"}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Rôle</Text>
        <Text style={styles.value}>{user?.role ?? "—"}</Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Statut</Text>
        <Text style={styles.value}>{user?.status ?? "—"}</Text>
      </View>

      <Pressable
        style={styles.navButton}
        onPress={() => router.push("/notifications")}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir les notifications"
      >
        <Text style={styles.navButtonText}>Notifications</Text>
      </Pressable>

      <Pressable
        style={[styles.button, signingOut && styles.buttonDisabled]}
        onPress={onSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Déconnexion</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  container: {
    padding: 20,
    backgroundColor: "#f8fafc",
    flexGrow: 1,
  },
  field: {
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: "#0f172a",
    fontFamily: "monospace",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 12,
  },
  navButton: {
    marginTop: 8,
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  navButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  button: {
    marginTop: 16,
    backgroundColor: "#b91c1c",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
