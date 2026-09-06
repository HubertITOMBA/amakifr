/**
 * Menu profil — cards hub (helpers purs testables).
 */

export type ProfileMenuId =
  | "compte"
  | "identite"
  | "coordonnees"
  | "contact";

export type ProfileMenuItem = {
  id: ProfileMenuId;
  title: string;
  hint: string;
  href:
    | "/profil/compte"
    | "/profil/identite"
    | "/profil/coordonnees"
    | "/profil/contact";
  symbol: {
    ios: "person.crop.circle" | "person.text.rectangle" | "house" | "phone";
    android: "account_circle" | "badge" | "home" | "call";
    web: "account_circle" | "badge" | "home" | "call";
  };
};

export const PROFILE_MENU_ITEMS: ProfileMenuItem[] = [
  {
    id: "compte",
    title: "Mon compte",
    hint: "E-mail, rôle, dernière connexion",
    href: "/profil/compte",
    symbol: {
      ios: "person.crop.circle",
      android: "account_circle",
      web: "account_circle",
    },
  },
  {
    id: "identite",
    title: "Identité",
    hint: "Civilité, nom, prénom",
    href: "/profil/identite",
    symbol: {
      ios: "person.text.rectangle",
      android: "badge",
      web: "badge",
    },
  },
  {
    id: "coordonnees",
    title: "Mes coordonnées",
    hint: "Adresses",
    href: "/profil/coordonnees",
    symbol: {
      ios: "house",
      android: "home",
      web: "home",
    },
  },
  {
    id: "contact",
    title: "Contact",
    hint: "Téléphones",
    href: "/profil/contact",
    symbol: {
      ios: "phone",
      android: "call",
      web: "call",
    },
  },
];

/**
 * Indique si le hub profil doit afficher les détails inline (jamais).
 */
export function profileHubShowsInlineDetails(): boolean {
  return false;
}

/**
 * Sections API non appelées au montage du hub.
 */
export function profileDetailSections(): ProfileMenuId[] {
  return ["compte", "identite", "coordonnees", "contact"];
}
