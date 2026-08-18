import { SymbolView } from "expo-symbols";
import type { ColorValue } from "react-native";
import { AmakiColors } from "@/constants/theme";

type TabIconName = "home" | "cotisations" | "notifications" | "profil";

const SYMBOLS = {
  home: { ios: "house.fill", android: "home", web: "home" },
  cotisations: {
    ios: "creditcard.fill",
    android: "payments",
    web: "payments",
  },
  notifications: {
    ios: "bell.fill",
    android: "notifications",
    web: "notifications",
  },
  profil: { ios: "person.fill", android: "person", web: "person" },
} as const;

type Props = {
  name: TabIconName;
  color: ColorValue;
};

/**
 * Icône de tab — expo-symbols (déjà dans le projet).
 */
export function TabBarIcon({ name, color }: Props) {
  return (
    <SymbolView
      name={SYMBOLS[name]}
      size={24}
      tintColor={typeof color === "string" ? color : AmakiColors.primary}
      weight="medium"
    />
  );
}
