/**
 * Guides d'aide pour le chatbot
 * Contient toutes les réponses et instructions pour guider les adhérents
 */

export interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
}

export interface ChatAction {
  label: string;
  action: string;
  href?: string;
  onClick?: () => void;
}

export interface Guide {
  keywords: string[];
  title: string;
  steps: string[];
  actions?: ChatAction[];
}

/**
 * Guides disponibles pour le chatbot
 */
export const chatbotGuides: Guide[] = [
  {
    keywords: ['mot de passe', 'password', 'changer mot de passe', 'modifier mot de passe', 'oublié mot de passe', 'reset password', 'mdp', 'changer mdp', 'modifier mdp', 'mot passe'],
    title: 'Comment modifier mon mot de passe',
    steps: [
      'Cliquez sur votre nom ou photo en haut à droite de l\'écran',
      'Sélectionnez "Paramètres" ou "Mon Profil"',
      'Dans la section "Sécurité", cliquez sur "Modifier le mot de passe"',
      'Entrez votre mot de passe actuel',
      'Entrez votre nouveau mot de passe (minimum 8 caractères)',
      'Confirmez votre nouveau mot de passe',
      'Cliquez sur "Enregistrer"',
      'Si vous avez oublié votre mot de passe, utilisez le lien "Mot de passe oublié" sur la page de connexion'
    ],
    actions: [
      { label: 'Ouvrir mon profil', action: 'open_profile', href: '/user/profile?section=settings' },
      { label: 'Page de connexion', action: 'open_login', href: '/auth/sign-in' }
    ]
  },
  {
    keywords: ['cotisation', 'payer cotisation', 'paiement cotisation', 'cotisation mensuelle', 'payer', 'paiement', 'cotiser', 'verser', 'régler', 'payer ma cotisation', 'comment payer'],
    title: 'Comment payer ma cotisation',
    steps: [
      'Allez dans "Mon Profil" > "Mes Cotisations"',
      'Vous verrez vos cotisations en attente et vos dettes',
      'Cliquez sur le bouton "Payer" à côté de la cotisation ou de la dette',
      'Choisissez le montant à payer (vous pouvez payer partiellement)',
      'Sélectionnez votre moyen de paiement (Carte bancaire, Virement, Chèque)',
      'Suivez les instructions à l\'écran pour finaliser le paiement',
      'Vous recevrez une confirmation par email après le paiement',
      'Pour payer en plusieurs fois : vous pouvez effectuer plusieurs paiements partiels jusqu\'à régulariser votre situation'
    ],
    actions: [
      { label: 'Voir mes cotisations', action: 'open_cotisations', href: '/user/profile?section=cotisations' },
      { label: 'Page de paiement', action: 'open_paiement', href: '/paiement' }
    ]
  },
  {
    keywords: ['photo', 'avatar', 'image profil', 'changer photo', 'modifier photo', 'photo profil', 'image', 'photo de profil', 'changer ma photo', 'modifier ma photo'],
    title: 'Comment modifier ma photo de profil',
    steps: [
      'Allez dans "Mon Profil"',
      'Cliquez sur votre photo de profil en haut de la page',
      'Sélectionnez "Modifier la photo" ou l\'icône de caméra',
      'Choisissez une nouvelle photo depuis votre appareil',
      'Recadrez la photo si nécessaire',
      'Cliquez sur "Enregistrer"',
      'Votre nouvelle photo sera visible immédiatement'
    ],
    actions: [
      { label: 'Ouvrir mon profil', action: 'open_profile', href: '/user/profile' }
    ]
  },
  {
    keywords: ['payer plusieurs fois', 'paiement partiel', 'paiement échelonné', 'plusieurs paiements'],
    title: 'Comment payer ma cotisation en plusieurs fois',
    steps: [
      'Allez dans "Mon Profil" > "Mes Cotisations"',
      'Vous verrez le montant total à payer',
      'Cliquez sur "Payer"',
      'Entrez le montant que vous souhaitez payer maintenant (il peut être inférieur au montant total)',
      'Choisissez votre moyen de paiement et finalisez',
      'Le montant restant sera toujours visible dans "Mes Cotisations"',
      'Vous pouvez répéter cette opération autant de fois que nécessaire jusqu\'à régulariser votre situation',
      'Chaque paiement sera enregistré et visible dans votre historique'
    ],
    actions: [
      { label: 'Voir mes cotisations', action: 'open_cotisations', href: '/user/profile?section=cotisations' }
    ]
  },
  {
    keywords: ['profil', 'modifier profil', 'éditer profil', 'mettre à jour profil', 'informations personnelles', 'changer profil', 'modifier mon profil', 'éditer mon profil', 'mes informations'],
    title: 'Comment modifier mon profil',
    steps: [
      'Allez dans "Mon Profil"',
      'Cliquez sur le bouton "Modifier" ou "Éditer" en haut de la page',
      'Vous serez redirigé vers la page de modification',
      'Modifiez les informations que vous souhaitez changer (nom, prénom, adresse, téléphone, etc.)',
      'Cliquez sur "Enregistrer" pour sauvegarder vos modifications',
      'Vos modifications seront immédiatement visibles dans votre profil'
    ],
    actions: [
      { label: 'Ouvrir mon profil', action: 'open_profile', href: '/user/profile' },
      { label: 'Modifier mon profil', action: 'open_edit', href: '/user/update' }
    ]
  },
  {
    keywords: ['passeport', 'imprimer passeport', 'télécharger passeport', 'pdf passeport', 'mon passeport', 'imprimer mon passeport', 'télécharger mon passeport'],
    title: 'Comment imprimer mon passeport',
    steps: [
      'Allez dans "Mon Profil" > "Mon Passeport"',
      'Vous verrez toutes les informations de votre passeport adhérent',
      'Cliquez sur le bouton "Télécharger le PDF" ou "Imprimer"',
      'Le fichier PDF sera généré et téléchargé automatiquement',
      'Ouvrez le PDF et imprimez-le depuis votre imprimante',
      'Le passeport contient vos droits et obligations en tant qu\'adhérent'
    ],
    actions: [
      { label: 'Ouvrir mon passeport', action: 'open_passeport', href: '/user/profile?section=passeport' }
    ]
  },
  {
    keywords: ['document', 'télécharger document', 'voir document', 'mes documents'],
    title: 'Comment accéder à mes documents',
    steps: [
      'Allez dans "Mon Profil" > "Mes Documents"',
      'Vous verrez la liste de tous vos documents disponibles',
      'Cliquez sur un document pour le télécharger',
      'Vous pouvez également filtrer par type de document si nécessaire'
    ],
    actions: [
      { label: 'Voir mes documents', action: 'open_documents', href: '/user/profile?section=documents' }
    ]
  },
  {
    keywords: ['badge', 'badges', 'récompenses', 'mes badges'],
    title: 'Comment voir mes badges',
    steps: [
      'Allez dans "Mon Profil" > "Mes Badges"',
      'Vous verrez tous les badges que vous avez obtenus',
      'Chaque badge affiche sa description et la date d\'obtention'
    ],
    actions: [
      { label: 'Voir mes badges', action: 'open_badges', href: '/user/profile?section=badges' }
    ]
  },
  {
    keywords: ['candidature', 'candidatures', 'postuler', 'candidater'],
    title: 'Comment postuler à une élection',
    steps: [
      'Allez dans "Mon Profil" > "Mes Candidatures"',
      'Cliquez sur "Nouvelle candidature"',
      'Sélectionnez l\'élection pour laquelle vous souhaitez postuler',
      'Choisissez le poste',
      'Remplissez le formulaire de candidature',
      'Soumettez votre candidature',
      'Vous pourrez suivre le statut de votre candidature dans "Mes Candidatures"'
    ],
    actions: [
      { label: 'Voir mes candidatures', action: 'open_candidatures', href: '/user/profile?section=candidatures' },
      { label: 'Voir les élections', action: 'open_elections', href: '/candidatures' }
    ]
  },
  {
    keywords: ['vote', 'voter', 'élection', 'élections'],
    title: 'Comment voter',
    steps: [
      'Allez dans la section "Vote" du menu principal',
      'Sélectionnez l\'élection pour laquelle vous souhaitez voter',
      'Consultez les candidatures et leurs programmes',
      'Cliquez sur "Voter" pour le candidat de votre choix',
      'Confirmez votre vote',
      'Vous pouvez voir vos votes dans "Mon Profil" > "Mes Votes"'
    ],
    actions: [
      { label: 'Voir les élections', action: 'open_elections', href: '/vote' },
      { label: 'Mes votes', action: 'open_votes', href: '/user/profile?section=votes' }
    ]
  },
  {
    keywords: ['événement', 'événements', 'evenement', 'evenements', 'participer événement', 'inscription événement', 'voir événements', 'liste événements', 'calendrier'],
    title: 'Comment participer à un événement',
    steps: [
      'Allez dans la section "Événements" du menu principal',
      'Parcourez la liste des événements à venir',
      'Cliquez sur l\'événement qui vous intéresse pour voir les détails',
      'Si l\'inscription est ouverte, cliquez sur "S\'inscrire" ou "Participer"',
      'Remplissez le formulaire d\'inscription si nécessaire',
      'Confirmez votre participation',
      'Vous recevrez une confirmation par email',
      'Vous pouvez voir tous vos événements dans "Mon Profil" > "Mes Événements"'
    ],
    actions: [
      { label: 'Voir les événements', action: 'open_events', href: '/evenements' }
    ]
  },
  {
    keywords: ['rapport', 'rapports', 'réunion', 'reunion', 'compte rendu', 'rapport réunion', 'rapports réunion', 'compte rendu réunion'],
    title: 'Comment consulter les rapports de réunion',
    steps: [
      'Allez dans "Mon Profil" > "Rapports de Réunion"',
      'Vous verrez la liste de tous les rapports de réunion mensuels',
      'Cliquez sur "Lire" pour voir le contenu complet d\'un rapport',
      'Vous pouvez également cliquer sur "Imprimer" pour télécharger le rapport en PDF',
      'Les rapports sont classés par date, du plus récent au plus ancien'
    ],
    actions: [
      { label: 'Voir les rapports', action: 'open_rapports', href: '/user/profile?section=rapports' }
    ]
  },
  {
    keywords: ['notification', 'notifications', 'alerte', 'alertes', 'préférences notification', 'gérer notifications'],
    title: 'Comment gérer mes notifications',
    steps: [
      'Allez dans "Mon Profil" > "Notifications"',
      'Vous verrez vos préférences de notifications',
      'Activez ou désactivez les types de notifications que vous souhaitez recevoir',
      'Vous pouvez choisir de recevoir des notifications par email, SMS, ou dans l\'application',
      'Sauvegardez vos préférences',
      'Vous recevrez les notifications selon vos préférences'
    ],
    actions: [
      { label: 'Gérer mes notifications', action: 'open_notifications', href: '/user/profile?section=notifications' }
    ]
  },
  {
    keywords: ['idée', 'idées', 'idee', 'idees', 'proposer idée', 'soumettre idée', 'boîte à idées'],
    title: 'Comment proposer une idée',
    steps: [
      'Allez dans "Mon Profil" > "Mes Idées"',
      'Cliquez sur "Nouvelle idée" ou "Proposer une idée"',
      'Remplissez le formulaire avec votre idée',
      'Ajoutez une description détaillée',
      'Soumettez votre idée',
      'Votre idée sera examinée par les administrateurs',
      'Vous pouvez suivre le statut de votre idée dans "Mes Idées"'
    ],
    actions: [
      { label: 'Voir mes idées', action: 'open_idees', href: '/user/profile?section=idees' }
    ]
  },
  {
    keywords: ['galerie', 'photos', 'images', 'vidéos', 'videos', 'voir galerie', 'consulter galerie'],
    title: 'Comment consulter la galerie',
    steps: [
      'Allez dans la section "Galerie" du menu principal',
      'Vous verrez toutes les photos et vidéos de l\'association',
      'Vous pouvez filtrer par type (photos, vidéos)',
      'Cliquez sur une image pour l\'agrandir',
      'Les médias sont organisés par événements ou catégories'
    ],
    actions: [
      { label: 'Voir la galerie', action: 'open_galerie', href: '/galerie' }
    ]
  },
  {
    keywords: ['contact', 'contacter', 'support', 'aide', 'assistance', 'écrire', 'message'],
    title: 'Comment contacter l\'association',
    steps: [
      'Allez dans la section "Contact" du menu principal',
      'Remplissez le formulaire de contact',
      'Indiquez votre nom, email et votre message',
      'Sélectionnez le sujet de votre demande',
      'Envoyez votre message',
      'Vous recevrez une réponse par email dans les plus brefs délais'
    ],
    actions: [
      { label: 'Page de contact', action: 'open_contact', href: '/contact' }
    ]
  },
  {
    keywords: ['inscription', 's\'inscrire', 'sinscrire', 'adhérer', 'adherer', 'devenir membre', 'nouveau membre'],
    title: 'Comment s\'inscrire à l\'association',
    steps: [
      'Allez dans la section "Inscription" du menu principal',
      'Remplissez le formulaire d\'inscription avec vos informations',
      'Vérifiez que toutes les informations sont correctes',
      'Acceptez les conditions d\'utilisation',
      'Soumettez votre demande d\'inscription',
      'Vous recevrez un email de confirmation',
      'Votre demande sera examinée par les administrateurs',
      'Une fois approuvée, vous recevrez vos identifiants de connexion'
    ],
    actions: [
      { label: 'Page d\'inscription', action: 'open_inscription', href: '/inscription' }
    ]
  },
  {
    keywords: ['enfant', 'enfants', 'ajouter enfant', 'modifier enfant', 'gérer enfants', 'mes enfants'],
    title: 'Comment gérer mes enfants',
    steps: [
      'Allez dans "Mon Profil" > "Mes Enfants"',
      'Cliquez sur "Ajouter un enfant" pour enregistrer un nouvel enfant',
      'Remplissez les informations de l\'enfant (nom, prénom, date de naissance)',
      'Vous pouvez modifier les informations d\'un enfant existant',
      'Les informations sur vos enfants sont utilisées pour les événements familiaux et les assistances'
    ],
    actions: [
      { label: 'Gérer mes enfants', action: 'open_enfants', href: '/user/profile?section=enfants' }
    ]
  },
  {
    keywords: ['statistique', 'statistiques', 'stats', 'mes stats', 'mon activité', 'mon historique'],
    title: 'Comment voir mes statistiques',
    steps: [
      'Allez dans "Mon Profil" > "Statistiques"',
      'Vous verrez vos statistiques personnelles :',
      '• Nombre de cotisations payées',
      '• Nombre d\'événements auxquels vous avez participé',
      '• Nombre de votes effectués',
      '• Nombre de badges obtenus',
      '• Votre ancienneté dans l\'association',
      'Ces statistiques sont mises à jour automatiquement'
    ],
    actions: [
      { label: 'Voir mes statistiques', action: 'open_statistiques', href: '/user/profile?section=statistiques' }
    ]
  },
  {
    keywords: ['dette', 'dettes', 'devoir', 'devoirs', 'mes dettes', 'dettes initiales', 'voir mes dettes'],
    title: 'Comment voir mes dettes',
    steps: [
      'Allez dans "Mon Profil" > "Mes Cotisations"',
      'Vous verrez la section "Dettes initiales"',
      'Toutes vos dettes sont listées par année',
      'Pour chaque dette, vous verrez le montant total et le montant restant à payer',
      'Cliquez sur "Payer" pour régler une dette',
      'Vous pouvez payer une dette en plusieurs fois'
    ],
    actions: [
      { label: 'Voir mes cotisations', action: 'open_cotisations', href: '/user/profile?section=cotisations' }
    ]
  },
  {
    keywords: ['historique', 'historique paiement', 'historique cotisation', 'mes paiements', 'voir paiements'],
    title: 'Comment voir mon historique de paiements',
    steps: [
      'Allez dans "Mon Profil" > "Mes Cotisations"',
      'Vous verrez la section "Historique des cotisations"',
      'Tous vos paiements sont listés avec la date, le montant et le moyen de paiement',
      'Vous pouvez filtrer par période ou par type de cotisation',
      'Chaque paiement affiche un reçu téléchargeable'
    ],
    actions: [
      { label: 'Voir mes cotisations', action: 'open_cotisations', href: '/user/profile?section=cotisations' }
    ]
  },
  {
    keywords: ['statut', 'statuts', 'juridique', 'loi 1901', 'consulter statut', 'voir statut', 'règlement'],
    title: 'Comment consulter les statuts de l\'association',
    steps: [
      'Allez dans la section "L\'amicale" du menu principal',
      'Dans la section "Informations Légales", cliquez sur "Notre Statut"',
      'Le dialog des statuts s\'ouvrira avec tous les articles',
      'Vous pouvez lire les statuts complets dans le dialog',
      'Cliquez sur "Télécharger le PDF" pour obtenir une copie officielle des statuts signés',
      'Les statuts ont été validés et signés par les autorités le 29 novembre 2025'
    ],
    actions: [
      { label: 'Voir la page Amicale', action: 'open_amicale', href: '/amicale' }
    ]
  },
  {
    keywords: ['aide', 'help', 'assistance', 'support', 'comment faire', 'amaki', 'qui es-tu', 'présente-toi'],
    title: 'Besoin d\'aide ?',
    steps: [
      'Bonjour ! Je suis Amaki, votre assistant virtuel sur la plateforme AMAKI France.',
      'Je suis là pour vous aider à naviguer et utiliser toutes les fonctionnalités de la plateforme.',
      'Vous pouvez me poser des questions sur :',
      '• Comment modifier votre mot de passe',
      '• Comment payer vos cotisations',
      '• Comment modifier votre photo de profil',
      '• Comment modifier votre profil',
      '• Comment imprimer votre passeport',
      '• Comment accéder à vos documents',
      '• Comment voir vos badges',
      '• Comment postuler à une élection',
      '• Comment voter',
      '• Comment participer à un événement',
      '• Comment consulter les rapports de réunion',
      '• Comment gérer vos notifications',
      '• Comment proposer une idée',
      'Tapez simplement votre question et je vous guiderai étape par étape !'
    ]
  }
];

/**
 * Normalise une chaîne pour la comparaison (supprime accents, ponctuation, etc.)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^\w\s]/g, ' ') // Remplace la ponctuation par des espaces
    .replace(/\s+/g, ' ') // Normalise les espaces
    .trim();
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes (pour la détection de fautes)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Vérifie si deux mots sont similaires (tolérance aux fautes)
 */
function isSimilar(word1: string, word2: string, threshold: number = 2): boolean {
  const normalized1 = normalizeString(word1);
  const normalized2 = normalizeString(word2);
  
  if (normalized1 === normalized2) return true;
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;
  
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLen = Math.max(normalized1.length, normalized2.length);
  
  // Si la distance est faible par rapport à la longueur, considérer comme similaire
  return distance <= threshold && distance / maxLen < 0.3;
}

/**
 * Trouve le guide correspondant à une question avec amélioration de la détection
 */
export function findGuideForQuestion(question: string): Guide | null {
  const questionLower = normalizeString(question);
  
  // Si la question est vide, retourner null
  if (!questionLower) {
    return null;
  }
  
  // Mots de la question
  const questionWords = questionLower.split(' ').filter(w => w.length > 2);
  
  // Chercher le guide avec le plus de mots-clés correspondants
  let bestMatch: Guide | null = null;
  let bestScore = 0;
  
  for (const guide of chatbotGuides) {
    let score = 0;
    let exactMatches = 0;
    let partialMatches = 0;
    
    for (const keyword of guide.keywords) {
      const keywordLower = normalizeString(keyword);
      const keywordWords = keywordLower.split(' ');
      
      // Vérifier correspondance exacte
      if (questionLower.includes(keywordLower) || keywordLower.includes(questionLower)) {
        score += 3;
        exactMatches++;
        // Bonus si le mot-clé est au début de la question
        if (questionLower.startsWith(keywordLower)) {
          score += 2;
        }
      } else {
        // Vérifier correspondance partielle (mots individuels)
        for (const keywordWord of keywordWords) {
          if (keywordWord.length > 2) {
            for (const questionWord of questionWords) {
              if (questionWord.includes(keywordWord) || keywordWord.includes(questionWord)) {
                score += 1;
                partialMatches++;
              } else if (isSimilar(questionWord, keywordWord)) {
                score += 0.5;
                partialMatches++;
              }
            }
          }
        }
      }
    }
    
    // Bonus si plusieurs mots-clés correspondent
    if (exactMatches > 1) {
      score += exactMatches;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = guide;
    }
  }
  
  // Si aucun match n'a été trouvé avec un score > 0, retourner le guide d'aide par défaut
  if (bestScore === 0) {
    // Chercher le guide d'aide
    return chatbotGuides.find(g => g.keywords.includes('aide')) || null;
  }
  
  return bestMatch;
}

/**
 * Génère une réponse du bot basée sur une question
 */
export function generateBotResponse(question: string): { message: string; guide?: Guide } {
  if (!question || !question.trim()) {
    return {
      message: `Bonjour ! Je suis Amaki, votre assistant virtuel. Posez-moi une question et je vous guiderai étape par étape !\n\nJe peux vous aider avec :\n• Modifier votre mot de passe\n• Payer vos cotisations\n• Modifier votre photo de profil\n• Modifier votre profil\n• Imprimer votre passeport\n• Accéder à vos documents\n• Voir vos badges\n• Postuler à une élection\n• Voter\n• Participer à un événement\n• Consulter les rapports de réunion\n• Gérer vos notifications\n• Proposer une idée\n• Consulter la galerie\n• Contacter l'association`
    };
  }
  
  const guide = findGuideForQuestion(question);
  
  if (guide) {
    const message = `Voici comment ${guide.title.toLowerCase()} :\n\n${guide.steps.map((step, index) => `${index + 1}. ${step}`).join('\n\n')}\n\nN'hésitez pas si vous avez d'autres questions !`;
    return { message, guide };
  }
  
  // Réponse par défaut avec suggestions
  return {
    message: `Je n'ai pas trouvé de guide spécifique pour votre question "${question}". Mais ne vous inquiétez pas, je suis là pour vous aider !\n\nVoici ce que je peux vous expliquer :\n• Modifier votre mot de passe\n• Payer vos cotisations\n• Modifier votre photo de profil\n• Modifier votre profil\n• Imprimer votre passeport\n• Accéder à vos documents\n• Voir vos badges\n• Postuler à une élection\n• Voter\n• Participer à un événement\n• Consulter les rapports de réunion\n• Gérer vos notifications\n• Proposer une idée\n• Consulter la galerie\n• Contacter l'association\n\nPosez-moi une question plus précise en utilisant des mots-clés comme "mot de passe", "cotisation", "photo", "profil", "passeport", "événement", "rapport", etc. et je vous guiderai étape par étape !`
  };
}

/**
 * Messages de bienvenue
 */
export const welcomeMessages = [
  "Bonjour ! Je suis Amaki, votre assistant virtuel. Je suis là pour vous aider à naviguer sur la plateforme. Comment puis-je vous assister aujourd'hui ?",
  "Salut ! Moi c'est Amaki. Je suis là pour vous guider dans l'utilisation de la plateforme AMAKI France. Que souhaitez-vous faire ?",
  "Bonjour ! Je suis Amaki, votre assistant. Posez-moi une question et je vous expliquerai comment procéder étape par étape.",
  "Bonjour ! Amaki à votre service. Je peux vous aider avec toutes vos questions sur la plateforme. Que puis-je faire pour vous ?"
];

/**
 * Messages d'aide rapide
 */
export const quickHelpMessages = [
  "Voici quelques actions que je peux vous aider à réaliser :",
  "Je peux vous guider pour :",
  "Voici ce que je peux vous expliquer :"
];

/**
 * Suggestions de questions rapides
 */
export const quickQuestions = [
  "Comment payer ma cotisation ?",
  "Comment modifier mon mot de passe ?",
  "Comment modifier ma photo ?",
  "Comment voir mes documents ?",
  "Comment participer à un événement ?",
  "Comment consulter les rapports ?",
  "Comment voir mes badges ?",
  "Comment modifier mon profil ?"
];
