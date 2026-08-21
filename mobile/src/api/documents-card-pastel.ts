/**
 * Palette pastel locale — cards Mes documents uniquement.
 * Ne modifie pas AmakiColors / thème global.
 */
export const DocumentCardPastel = {
  /** En attente — crème / ambre doux */
  waiting: {
    cardBg: "#fffcf5",
    borderLeft: "#c4a574",
    badgeBg: "#fef6e8",
    badgeText: "#7c5a2a",
    badgeBorder: "#edd9b8",
  },
  /** Validé — vert pastel très léger */
  validated: {
    cardBg: "#f6faf7",
    borderLeft: "#8fad96",
    badgeBg: "#eaf4ec",
    badgeText: "#2f5d3a",
    badgeBorder: "#c9dfcf",
  },
  /** Rejeté — rose/rouge pastel */
  rejected: {
    cardBg: "#fdf7f7",
    borderLeft: "#c49a9a",
    badgeBg: "#f8eaea",
    badgeText: "#8b3a3a",
    badgeBorder: "#e8c9c9",
  },
  /** Neutre / Privé — gris-bleu doux */
  neutral: {
    cardBg: "#f8fafc",
    borderLeft: "#b8c4d4",
    badgeBg: "#f1f5f9",
    badgeText: "#475569",
    badgeBorder: "#dde4ed",
  },
  /** Public — bleu pastel très léger */
  public: {
    badgeBg: "#eef3f9",
    badgeText: "#3d5a80",
    badgeBorder: "#d0dceb",
  },
} as const;

export type DocumentCardPastelKey = keyof typeof DocumentCardPastel;

/**
 * Accent card selon statutValidation.
 */
export function documentCardPastelAccent(statutValidation: string): {
  cardBg: string;
  borderLeft: string;
} {
  if (statutValidation === "Valide") {
    return {
      cardBg: DocumentCardPastel.validated.cardBg,
      borderLeft: DocumentCardPastel.validated.borderLeft,
    };
  }
  if (statutValidation === "Rejete") {
    return {
      cardBg: DocumentCardPastel.rejected.cardBg,
      borderLeft: DocumentCardPastel.rejected.borderLeft,
    };
  }
  return {
    cardBg: DocumentCardPastel.waiting.cardBg,
    borderLeft: DocumentCardPastel.waiting.borderLeft,
  };
}

/**
 * Couleurs badge validation (texte foncé + fond pâle).
 */
export function documentValidationPastelBadge(statutValidation: string): {
  bg: string;
  text: string;
  border: string;
} {
  if (statutValidation === "Valide") {
    return {
      bg: DocumentCardPastel.validated.badgeBg,
      text: DocumentCardPastel.validated.badgeText,
      border: DocumentCardPastel.validated.badgeBorder,
    };
  }
  if (statutValidation === "Rejete") {
    return {
      bg: DocumentCardPastel.rejected.badgeBg,
      text: DocumentCardPastel.rejected.badgeText,
      border: DocumentCardPastel.rejected.badgeBorder,
    };
  }
  return {
    bg: DocumentCardPastel.waiting.badgeBg,
    text: DocumentCardPastel.waiting.badgeText,
    border: DocumentCardPastel.waiting.badgeBorder,
  };
}

/**
 * Couleurs badge publication Public / Privé.
 */
export function documentPublicationPastelBadge(estPublic: boolean): {
  bg: string;
  text: string;
  border: string;
} {
  if (estPublic) {
    return {
      bg: DocumentCardPastel.public.badgeBg,
      text: DocumentCardPastel.public.badgeText,
      border: DocumentCardPastel.public.badgeBorder,
    };
  }
  return {
    bg: DocumentCardPastel.neutral.badgeBg,
    text: DocumentCardPastel.neutral.badgeText,
    border: DocumentCardPastel.neutral.badgeBorder,
  };
}
