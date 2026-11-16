import { Stack } from "expo-router";
import { AmakiGradientHeader } from "@/components/layout/amaki-gradient-header";
import {
  resolveHeaderTitle,
  type AmakiNavHeaderProps,
} from "@/components/layout/amaki-stack-header";
import {
  HEADER_BOTTOM_RADIUS_COMPACT,
  HEADER_SHELL_PADDING_BOTTOM_SONDAGES,
  shouldShowHeaderBack,
} from "@/features/layout/gradient-header-model";
import { AmakiColors } from "@/constants/theme";

/**
 * Header Sondages — rayon commun (HEADER_BOTTOM_RADIUS) + padding bas
 * spécifique pour laisser « En cours » visible (texte large Android).
 */
function SondagesStackHeader(props: AmakiNavHeaderProps) {
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
      bottomRadius={HEADER_BOTTOM_RADIUS_COMPACT}
      shellPaddingBottom={HEADER_SHELL_PADDING_BOTTOM_SONDAGES}
    />
  );
}

/**
 * Stack Sondages — header dégradé partagé (padding bas local uniquement).
 */
export default function SondagesLayout() {
  return (
    <Stack
      screenOptions={{
        header: (props) => <SondagesStackHeader {...props} />,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: AmakiColors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Sondages et Quiz" }} />
      <Stack.Screen name="[id]" options={{ title: "Questionnaire" }} />
    </Stack>
  );
}
