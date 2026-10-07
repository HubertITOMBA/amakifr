import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import type { HomeIconName } from "@/features/home/home-model";
import { AmakiColors } from "@/constants/theme";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const SYMBOLS: Record<HomeIconName, SymbolName> = {
  documents: { ios: "doc.fill", android: "description", web: "description" },
  cotisations: { ios: "creditcard.fill", android: "payments", web: "payments" },
  reunions: { ios: "person.3.fill", android: "groups", web: "groups" },
  evenements: { ios: "calendar", android: "event", web: "event" },
  notifications: {
    ios: "bell.fill",
    android: "notifications",
    web: "notifications",
  },
  messages: { ios: "message.fill", android: "chat", web: "chat" },
  passeport: {
    ios: "person.text.rectangle.fill",
    android: "badge",
    web: "badge",
  },
  taches: { ios: "checklist", android: "checklist", web: "checklist" },
  elections: {
    ios: "checkmark.seal.fill",
    android: "how_to_vote",
    web: "how_to_vote",
  },
  sondages: {
    ios: "list.bullet.clipboard.fill",
    android: "poll",
    web: "poll",
  },
  profil: { ios: "person.fill", android: "person", web: "person" },
  menu: { ios: "line.3.horizontal", android: "menu", web: "menu" },
};

type Props = {
  name: HomeIconName;
  color?: ColorValue;
  size?: number;
};

/**
 * Icône accueil — expo-symbols (déjà dans le binaire).
 */
export function HomeSymbolIcon({
  name,
  color = AmakiColors.primary,
  size = 24,
}: Props) {
  return (
    <SymbolView
      name={SYMBOLS[name]}
      size={size}
      tintColor={typeof color === "string" ? color : AmakiColors.primary}
      weight="medium"
    />
  );
}
