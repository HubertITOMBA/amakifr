import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import amakiLogo from "@/assets/images/amaki-logo-full.png";
import { useAuth } from "@/auth/auth-context";
import { ApiClientError } from "@/api/types";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Card } from "@/components/ui/card";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

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
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image
              source={amakiLogo}
              style={styles.logo}
              accessibilityLabel="AMAKI France"
              alt="AMAKI France"
              contentFit="contain"
            />
            <Text style={styles.brand}>AMAKI France</Text>
            <Text style={styles.subtitle}>Espace adhérent</Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.fieldLabel}>E-mail</Text>
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
              placeholderTextColor={AmakiColors.textMuted}
              accessibilityLabel="E-mail"
            />

            <Text style={styles.fieldLabel}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              placeholder="••••••••"
              placeholderTextColor={AmakiColors.textMuted}
              accessibilityLabel="Mot de passe"
            />

            {error ? (
              <Text
                style={styles.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            ) : null}

            <PrimaryButton
              label="Connexion"
              loading={loading}
              onPress={onSubmit}
              style={styles.submit}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AmakiColors.primarySoft,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: AmakiSpacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: AmakiSpacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: AmakiRadius.lg,
    marginBottom: AmakiSpacing.md,
  },
  brand: {
    ...AmakiTypography.display,
    color: AmakiColors.primaryStrong,
    textAlign: "center",
  },
  subtitle: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    textAlign: "center",
    marginTop: AmakiSpacing.xs,
  },
  card: {
    padding: AmakiSpacing.lg,
  },
  fieldLabel: {
    ...AmakiTypography.label,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.sm,
    paddingHorizontal: AmakiSpacing.md,
    paddingVertical: AmakiSpacing.md,
    marginBottom: AmakiSpacing.lg,
    fontSize: 16,
    color: AmakiColors.text,
    backgroundColor: AmakiColors.background,
    minHeight: 48,
  },
  error: {
    ...AmakiTypography.caption,
    color: AmakiColors.danger,
    marginBottom: AmakiSpacing.md,
    fontWeight: "600",
  },
  submit: {
    marginTop: AmakiSpacing.xs,
  },
});
