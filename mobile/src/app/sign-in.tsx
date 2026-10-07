import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import amakiLogo from "@/assets/images/amaki-logo-full.png";
import { useAuth } from "@/auth/auth-context";
import { ApiClientError } from "@/api/types";
import { AmakiGradientShell } from "@/components/layout/amaki-gradient-header";
import { PrimaryButton } from "@/components/ui/primary-button";
import {
  AMAKI_BRAND_LOGO_SIZE,
  INITIAL_PASSWORD_VISIBLE,
  LOGIN_HEADER_VISUAL_BODY,
  LOGIN_LOGO_ELEVATION,
  LOGIN_LOGO_FRAME_PADDING,
  LOGIN_LOGO_FRAME_RADIUS,
  LOGIN_LOGO_SHADOW,
  LOGIN_LOGO_WRAP_MARGIN_TOP,
  loginHeaderContentPaddingTop,
  nextPasswordVisible,
  passwordVisibilityToggleLabel,
  resolveLoginStatusInset,
} from "@/features/auth/sign-in-model";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Connexion email / mot de passe — dégradé aligné sur l’accueil.
 * Action, validation et session inchangées.
 */
export default function SignInScreen() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(
    INITIAL_PASSWORD_VISIBLE
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "android") {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor("transparent");
      RNStatusBar.setBarStyle("light-content");
    }
  }, []);

  /** Ré-applique à chaque focus (le Stack peut réinitialiser la status bar). */
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "android") {
        RNStatusBar.setTranslucent(true);
        RNStatusBar.setBackgroundColor("transparent");
        RNStatusBar.setBarStyle("light-content");
      }
    }, [])
  );

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

  const sidePad = Math.max(insets.left, insets.right, 0);
  const statusInset = resolveLoginStatusInset(
    insets.top,
    Platform.OS === "android" ? RNStatusBar.currentHeight : null
  );
  const headerPadTop = loginHeaderContentPaddingTop(statusInset);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {/**
       * Pas de SafeAreaView top ni de marge négative globale :
       * le fond dégradé peint dès y=0 ; seul brandBlock reçoit l’inset.
       */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom: Math.max(insets.bottom, AmakiSpacing.lg),
              paddingLeft: AmakiSpacing.lg + sidePad,
              paddingRight: AmakiSpacing.lg + sidePad,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
          contentInsetAdjustmentBehavior="never"
        >
          <View
            style={[
              styles.hero,
              { marginHorizontal: -(AmakiSpacing.lg + sidePad) },
            ]}
          >
            <AmakiGradientShell
              statusInset={statusInset}
              visualBody={LOGIN_HEADER_VISUAL_BODY}
            >
              {/**
               * Inset + gap uniquement sur le texte — pas sur le fond
               * (absoluteFill reste à top:0).
               */}
              <View
                style={[
                  styles.brandBlock,
                  { paddingTop: headerPadTop },
                ]}
              >
                <Text style={styles.brand}>AMAKI France</Text>
                <Text style={styles.subtitle}>Espace adhérent</Text>
              </View>
            </AmakiGradientShell>

            <View style={styles.logoWrap}>
              <View style={styles.logoFrame}>
                <Image
                  source={amakiLogo}
                  style={styles.logo}
                  accessibilityLabel="AMAKI France"
                  alt="AMAKI France"
                  contentFit="contain"
                />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              placeholder="vous@exemple.com"
              placeholderTextColor={AmakiColors.textMuted}
              accessibilityLabel="E-mail"
            />

            <Text style={styles.fieldLabel}>Mot de passe</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                secureTextEntry={!passwordVisible}
                textContentType="password"
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                placeholder="••••••••"
                placeholderTextColor={AmakiColors.textMuted}
                accessibilityLabel="Mot de passe"
              />
              <Pressable
                onPress={() =>
                  setPasswordVisible((v) => nextPasswordVisible(v))
                }
                accessibilityRole="button"
                accessibilityLabel={passwordVisibilityToggleLabel(
                  passwordVisible
                )}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.eyeBtn,
                  pressed && styles.eyeBtnPressed,
                ]}
              >
                <SymbolView
                  name={
                    passwordVisible
                      ? {
                          ios: "eye.slash.fill",
                          android: "visibility_off",
                          web: "visibility_off",
                        }
                      : {
                          ios: "eye.fill",
                          android: "visibility",
                          web: "visibility",
                        }
                  }
                  size={22}
                  tintColor={AmakiColors.textSecondary}
                  weight="medium"
                />
              </Pressable>
            </View>

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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AmakiColors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "flex-start",
    /** Pas de paddingTop : le dégradé doit démarrer à y=0 (pas de bande claire). */
    paddingTop: 0,
  },
  hero: {
    marginTop: 0,
    marginBottom: AmakiSpacing.sm,
  },
  brandBlock: {
    alignItems: "center",
    paddingHorizontal: AmakiSpacing.lg,
    paddingBottom: AmakiSpacing.sm,
  },
  brand: {
    ...AmakiTypography.title,
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.6,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    ...AmakiTypography.caption,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    marginTop: AmakiSpacing.xs,
    fontWeight: "600",
  },
  logoWrap: {
    alignItems: "center",
    marginTop: LOGIN_LOGO_WRAP_MARGIN_TOP,
    zIndex: 10,
  },
  logoFrame: {
    padding: LOGIN_LOGO_FRAME_PADDING,
    borderRadius: LOGIN_LOGO_FRAME_RADIUS,
    backgroundColor: AmakiColors.surface,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    ...LOGIN_LOGO_SHADOW,
    elevation: LOGIN_LOGO_ELEVATION,
  },
  /** Glyph inchangé : 168×168 contain (padding = cadre uniquement). */
  logo: {
    width: AMAKI_BRAND_LOGO_SIZE,
    height: AMAKI_BRAND_LOGO_SIZE,
  },
  card: {
    backgroundColor: AmakiColors.surface,
    borderRadius: AmakiRadius.lg,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    padding: AmakiSpacing.lg,
    marginTop: AmakiSpacing.md,
    marginBottom: AmakiSpacing.lg,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  fieldLabel: {
    ...AmakiTypography.label,
    color: AmakiColors.textSecondary,
    marginBottom: AmakiSpacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.sm,
    paddingHorizontal: AmakiSpacing.md,
    paddingVertical: AmakiSpacing.md,
    marginBottom: AmakiSpacing.md,
    fontSize: 16,
    color: AmakiColors.text,
    backgroundColor: AmakiColors.surfaceMuted,
    minHeight: 48,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.sm,
    backgroundColor: AmakiColors.surfaceMuted,
    marginBottom: AmakiSpacing.md,
    minHeight: 48,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: AmakiSpacing.md,
    paddingVertical: AmakiSpacing.md,
    fontSize: 16,
    color: AmakiColors.text,
    minHeight: 48,
  },
  eyeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeBtnPressed: {
    opacity: 0.7,
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
