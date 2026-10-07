import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import {
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import headerGradient from "@/assets/images/home-header-gradient.png";
import {
  HEADER_BOTTOM_RADIUS,
  HEADER_ICON_HIT_SIZE,
  HEADER_VISUAL_BODY,
  HEADER_VISUAL_BODY_HOME,
  headerContentPaddingTop,
  headerMinHeight,
  resolveHeaderStatusInset,
} from "@/features/layout/gradient-header-model";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Variant = "default" | "home";

export type AmakiGradientHeaderProps = {
  /** Titre principal (obligatoire hors slot gauche custom). */
  title: string;
  /** Sous-titre optionnel sous le titre. */
  subtitle?: string;
  /** Affiche le chevron retour. */
  showBack?: boolean;
  /** Callback retour (défaut : aucun). */
  onBack?: () => void;
  /** Affiche le hamburger. */
  showMenu?: boolean;
  /** Callback menu. */
  onOpenMenu?: () => void;
  /** Contenu à droite (actions, badges). */
  rightSlot?: ReactNode;
  /** Variante hauteur (home = marge bas élargie). */
  variant?: Variant;
  /** Remplace la zone titre (ex. marque + icônes accueil). */
  centerSlot?: ReactNode;
};

/**
 * Applique status bar claire + translucide (Android).
 */
function useLightTranslucentStatusBar() {
  useEffect(() => {
    if (Platform.OS === "android") {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor("transparent");
      RNStatusBar.setBarStyle("light-content");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "android") {
        RNStatusBar.setTranslucent(true);
        RNStatusBar.setBackgroundColor("transparent");
        RNStatusBar.setBarStyle("light-content");
      }
    }, [])
  );
}

type ShellProps = {
  statusInset: number;
  visualBody: number;
  children: ReactNode;
};

/**
 * Coque dégradé edge-to-edge — fond à top:0, inset uniquement sur les enfants.
 */
export function AmakiGradientShell({
  statusInset,
  visualBody,
  children,
}: ShellProps) {
  const minH = headerMinHeight(statusInset, visualBody);
  return (
    <View style={[styles.gradientClip, { minHeight: minH }]}>
      <Image
        source={headerGradient}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        alt=""
        accessibilityIgnoresInvertColors
      />
      <View pointerEvents="none" style={styles.contrastVeil} />
      {children}
    </View>
  );
}

/**
 * Header dégradé partagé — même asset que Accueil / LoginPage.
 * Règle scroll : sticky (hors ScrollView) sur les écrans métier ;
 * Accueil / Login restent en flux pour le chevauchement logo.
 */
export function AmakiGradientHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  showMenu = false,
  onOpenMenu,
  rightSlot,
  variant = "default",
  centerSlot,
}: AmakiGradientHeaderProps) {
  const insets = useSafeAreaInsets();
  useLightTranslucentStatusBar();

  const statusInset = resolveHeaderStatusInset(
    insets.top,
    Platform.OS === "android" ? RNStatusBar.currentHeight : null
  );
  const padTop = headerContentPaddingTop(statusInset);
  const visualBody =
    variant === "home" ? HEADER_VISUAL_BODY_HOME : HEADER_VISUAL_BODY;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AmakiGradientShell statusInset={statusInset} visualBody={visualBody}>
        <View style={[styles.inner, { paddingTop: padTop }]}>
          <View style={styles.row}>
            <View style={styles.sideLeft}>
              {showBack ? (
                <Pressable
                  onPress={onBack}
                  accessibilityRole="button"
                  accessibilityLabel="Retour"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    pressed && styles.iconBtnPressed,
                  ]}
                >
                  <SymbolView
                    name={{
                      ios: "chevron.left",
                      android: "arrow_back",
                      web: "arrow_back",
                    }}
                    size={22}
                    tintColor="#ffffff"
                    weight="medium"
                  />
                </Pressable>
              ) : null}
              {showMenu ? (
                <Pressable
                  onPress={onOpenMenu}
                  accessibilityRole="button"
                  accessibilityLabel="Ouvrir le menu"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    pressed && styles.iconBtnPressed,
                  ]}
                >
                  <SymbolView
                    name={{
                      ios: "line.3.horizontal",
                      android: "menu",
                      web: "menu",
                    }}
                    size={22}
                    tintColor="#ffffff"
                    weight="medium"
                  />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.center} accessibilityRole="header">
              {centerSlot ?? (
                <>
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={styles.subtitle} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.sideRight}>{rightSlot ?? null}</View>
          </View>
        </View>
      </AmakiGradientShell>
    </View>
  );
}

/**
 * Bouton icône standard pour rightSlot (44×44).
 */
export function AmakiHeaderIconButton({
  accessibilityLabel,
  onPress,
  children,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconBtn,
        pressed && styles.iconBtnPressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1,
    elevation: 0,
    marginTop: 0,
    paddingTop: 0,
    backgroundColor: "transparent",
  },
  gradientClip: {
    overflow: "hidden",
    borderBottomLeftRadius: HEADER_BOTTOM_RADIUS,
    borderBottomRightRadius: HEADER_BOTTOM_RADIUS,
    marginTop: 0,
    paddingTop: 0,
    paddingBottom: AmakiSpacing.md,
  },
  contrastVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.38)",
  },
  inner: {
    paddingHorizontal: AmakiSpacing.md,
    paddingBottom: AmakiSpacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: HEADER_ICON_HIT_SIZE,
  },
  sideLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: AmakiSpacing.xs,
    minWidth: HEADER_ICON_HIT_SIZE,
  },
  sideRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: AmakiSpacing.xs,
    minWidth: HEADER_ICON_HIT_SIZE,
  },
  center: {
    flex: 1,
    paddingHorizontal: AmakiSpacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...AmakiTypography.title,
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 18,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    ...AmakiTypography.caption,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    marginTop: 2,
    fontWeight: "600",
  },
  iconBtn: {
    width: HEADER_ICON_HIT_SIZE,
    height: HEADER_ICON_HIT_SIZE,
    borderRadius: AmakiRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  iconBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});

/** Fond clair standard sous le header. */
export const AMAKI_SCREEN_BG = AmakiColors.background;
