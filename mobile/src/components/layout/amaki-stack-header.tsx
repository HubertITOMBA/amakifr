import { AmakiGradientHeader } from "@/components/layout/amaki-gradient-header";
import { shouldShowHeaderBack } from "@/features/layout/gradient-header-model";

/**
 * Props minimales compatibles Stack et Tabs (Expo Router).
 * Typage large : les options RN/Expo varient selon le navigateur.
 */
export type AmakiNavHeaderProps = {
  options: {
    title?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headerTitle?: any;
  };
  route: { name: string };
  navigation: {
    goBack: () => void;
    canGoBack: () => boolean;
  };
  back?: { title?: string } | undefined;
};

/**
 * Résout le titre affiché depuis les options Stack / Tabs.
 */
export function resolveHeaderTitle(
  options: AmakiNavHeaderProps["options"],
  fallback: string
): string {
  if (typeof options.headerTitle === "string") return options.headerTitle;
  if (typeof options.title === "string") return options.title;
  return fallback;
}

/**
 * Header Expo Router branché sur AmakiGradientHeader.
 * Stratégie unique : `header` custom (pas de second header dans l’écran).
 */
export function AmakiStackHeader(props: AmakiNavHeaderProps) {
  const { options, route, navigation, back } = props;
  const title = resolveHeaderTitle(options, route.name);
  const canGoBack =
    typeof navigation.canGoBack === "function"
      ? navigation.canGoBack()
      : Boolean(back);
  const showBack = shouldShowHeaderBack(
    route.name,
    canGoBack,
    Boolean(back)
  );

  return (
    <AmakiGradientHeader
      title={title}
      showBack={showBack}
      onBack={() => navigation.goBack()}
    />
  );
}
