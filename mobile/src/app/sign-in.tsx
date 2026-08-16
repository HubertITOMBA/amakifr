import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/auth/auth-context";
import { ApiClientError } from "@/api/types";

/**
 * Écran de connexion email / mot de passe.
 */
export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Adresse e-mail invalide");
      return;
    }
    if (!password) {
      setError("Mot de passe requis");
      return;
    }

    setLoading(true);
    try {
      await signIn(trimmed, password);
      setPassword("");
    } catch (e) {
      setPassword("");
      if (e instanceof ApiClientError) {
        if (e.status === 429) {
          setError("Trop de tentatives. Réessayez plus tard.");
        } else {
          setError(e.message);
        }
      } else {
        setError("Connexion impossible");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>AMAKI</Text>
        <Text style={styles.subtitle}>Connexion mobile</Text>

        <Text style={styles.label}>E-mail</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          placeholder="vous@exemple.com"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connexion</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#eff6ff",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  brand: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e3a8a",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 24,
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#1d4ed8",
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
