import { useEffect } from "react";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmakiGradientHeader } from "@/components/layout/amaki-gradient-header";
import { PrimaryButton } from "@/components/ui/primary-button";
import { passwordVisibilityToggleLabel } from "@/features/auth/sign-in-model";
import {
  PASSWORD_RESET_CODE_HELPER,
  PASSWORD_RESET_REQUEST_GENERIC_MESSAGE,
  PASSWORD_RESET_REQUEST_HELP,
  PASSWORD_RESET_SCREEN_TITLE,
  passwordResetCooldownRemaining,
  passwordResetResendLabel,
} from "@/features/auth/password-reset-model";
import { useForgotPasswordFlow } from "@/features/auth/use-forgot-password-flow";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Parcours natif « mot de passe oublié » — une seule route Expo.
 * Email / code / MDP uniquement en mémoire (contrôleur + état écran).
 * Filtrage code : chiffres puis slice(0,8) — jamais troncature native avant filtre.
 */
export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { state, flow } = useForgotPasswordFlow();
  const remaining = passwordResetCooldownRemaining(
    state.cooldownEndsAt,
    Date.now()
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      flow.onBack();
      return true;
    });
    return () => sub.remove();
  }, [flow]);

  // Tick cooldown UI (timers nettoyés au démontage)
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => flow.tick(), 1000);
    return () => clearInterval(id);
  }, [remaining, flow]);

  const sidePad = Math.max(insets.left, insets.right, 0);
  const busy = state.loading || flow.isBusy();

  return (
    <View style={styles.root}>
      <AmakiGradientHeader
        title={PASSWORD_RESET_SCREEN_TITLE}
        showBack
        onBack={() => flow.onBack()}
      />
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
        >
          <View style={styles.card}>
            {state.step === "request" ? (
              <>
                <Text style={styles.help}>{PASSWORD_RESET_REQUEST_HELP}</Text>
                <Text style={styles.fieldLabel}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  inputMode="email"
                  textContentType="emailAddress"
                  autoComplete="email"
                  value={state.email}
                  onChangeText={(t) => flow.setEmail(t)}
                  editable={!busy}
                  placeholder="vous@exemple.com"
                  placeholderTextColor={AmakiColors.textMuted}
                  accessibilityLabel="E-mail"
                />
                {state.error ? (
                  <Text
                    style={styles.error}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    {state.error}
                  </Text>
                ) : null}
                <PrimaryButton
                  label="Recevoir un code"
                  loading={busy}
                  disabled={busy}
                  onPress={() => void flow.requestCode(false)}
                  style={styles.submit}
                />
                <Pressable
                  onPress={() => flow.goToLogin()}
                  accessibilityRole="link"
                  accessibilityLabel="Retour connexion"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.linkBtn,
                    pressed && styles.linkPressed,
                  ]}
                >
                  <Text style={styles.linkText}>Retour connexion</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.info} accessibilityLiveRegion="polite">
                  {state.info ?? PASSWORD_RESET_REQUEST_GENERIC_MESSAGE}
                </Text>

                <Text style={styles.fieldLabel}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  inputMode="email"
                  textContentType="emailAddress"
                  autoComplete="email"
                  value={state.email}
                  onChangeText={(t) => flow.setEmail(t)}
                  editable={!busy}
                  accessibilityLabel="E-mail"
                />

                <Text style={styles.fieldLabel}>Code</Text>
                <Text style={styles.helper}>{PASSWORD_RESET_CODE_HELPER}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  value={state.code}
                  onChangeText={(t) => flow.setCodeFromRaw(t)}
                  editable={!busy}
                  placeholder="12345678"
                  placeholderTextColor={AmakiColors.textMuted}
                  accessibilityLabel="Code à 8 chiffres"
                />

                <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    secureTextEntry={!state.passwordVisible}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    value={state.password}
                    onChangeText={(t) => flow.setPassword(t)}
                    editable={!busy}
                    placeholder="••••••••"
                    placeholderTextColor={AmakiColors.textMuted}
                    accessibilityLabel="Nouveau mot de passe"
                  />
                  <Pressable
                    onPress={() => flow.togglePasswordVisible()}
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisibilityToggleLabel(
                      state.passwordVisible
                    )}
                    hitSlop={4}
                    style={({ pressed }) => [
                      styles.eyeBtn,
                      pressed && styles.eyeBtnPressed,
                    ]}
                  >
                    <SymbolView
                      name={
                        state.passwordVisible
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

                <Text style={styles.fieldLabel}>Confirmation</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    secureTextEntry={!state.confirmVisible}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    value={state.confirmPassword}
                    onChangeText={(t) => flow.setConfirmPassword(t)}
                    editable={!busy}
                    placeholder="••••••••"
                    placeholderTextColor={AmakiColors.textMuted}
                    accessibilityLabel="Confirmation du mot de passe"
                  />
                  <Pressable
                    onPress={() => flow.toggleConfirmVisible()}
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisibilityToggleLabel(
                      state.confirmVisible
                    )}
                    hitSlop={4}
                    style={({ pressed }) => [
                      styles.eyeBtn,
                      pressed && styles.eyeBtnPressed,
                    ]}
                  >
                    <SymbolView
                      name={
                        state.confirmVisible
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

                {state.error ? (
                  <Text
                    style={styles.error}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    {state.error}
                  </Text>
                ) : null}

                <PrimaryButton
                  label="Réinitialiser mon mot de passe"
                  loading={busy}
                  disabled={busy}
                  onPress={() => void flow.confirmReset()}
                  style={styles.submit}
                />

                <PrimaryButton
                  label={passwordResetResendLabel(remaining)}
                  loading={false}
                  disabled={busy || remaining > 0}
                  onPress={() => void flow.requestCode(true)}
                  style={styles.resend}
                />
              </>
            )}
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
    paddingTop: AmakiSpacing.md,
  },
  card: {
    backgroundColor: AmakiColors.surface,
    borderRadius: AmakiRadius.lg,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    padding: AmakiSpacing.lg,
    marginBottom: AmakiSpacing.lg,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  help: {
    ...AmakiTypography.body,
    color: AmakiColors.textSecondary,
    marginBottom: AmakiSpacing.md,
  },
  info: {
    ...AmakiTypography.body,
    color: AmakiColors.textSecondary,
    marginBottom: AmakiSpacing.md,
    fontWeight: "600",
  },
  helper: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginBottom: AmakiSpacing.xs,
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
  resend: {
    marginTop: AmakiSpacing.md,
  },
  linkBtn: {
    marginTop: AmakiSpacing.lg,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  linkPressed: {
    opacity: 0.7,
  },
  linkText: {
    ...AmakiTypography.body,
    color: AmakiColors.primary,
    fontWeight: "600",
    textAlign: "center",
  },
});
