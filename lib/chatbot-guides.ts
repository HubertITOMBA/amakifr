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
      'Tapez simplement votre question et je vous guiderai étape par étape !'
    ]
  }
];

/**
 * Trouve le guide correspondant à une question
 */
export function findGuideForQuestion(question: string): Guide | null {
  const questionLower = question.toLowerCase().trim();
  
  // Si la question est vide, retourner null
  if (!questionLower) {
    return null;
  }
  
  // Chercher le guide avec le plus de mots-clés correspondants
  let bestMatch: Guide | null = null;
  let bestScore = 0;
  
  for (const guide of chatbotGuides) {
    // Vérifier chaque mot-clé
    let score = 0;
    for (const keyword of guide.keywords) {
      const keywordLower = keyword.toLowerCase();
      // Vérifier si le mot-clé est présent dans la question
      if (questionLower.includes(keywordLower)) {
        score++;
        // Bonus si le mot-clé correspond exactement ou est au début
        if (questionLower.startsWith(keywordLower) || questionLower === keywordLower) {
          score += 2;
        }
      }
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
      message: `Bonjour ! Je suis Amaki, votre assistant virtuel. Posez-moi une question et je vous guiderai étape par étape !\n\nJe peux vous aider avec :\n• Modifier votre mot de passe\n• Payer vos cotisations\n• Modifier votre photo de profil\n• Modifier votre profil\n• Imprimer votre passeport\n• Accéder à vos documents\n• Voir vos badges\n• Postuler à une élection\n• Voter`
    };
  }
  
  const guide = findGuideForQuestion(question);
  
  if (guide) {
    const message = `Voici comment ${guide.title.toLowerCase()} :\n\n${guide.steps.map((step, index) => `${index + 1}. ${step}`).join('\n\n')}\n\nN'hésitez pas si vous avez d'autres questions !`;
    return { message, guide };
  }
  
  // Réponse par défaut avec suggestions
  return {
    message: `Je n'ai pas trouvé de guide spécifique pour votre question "${question}". Mais ne vous inquiétez pas, je suis là pour vous aider !\n\nVoici ce que je peux vous expliquer :\n• Modifier votre mot de passe\n• Payer vos cotisations\n• Modifier votre photo de profil\n• Modifier votre profil\n• Imprimer votre passeport\n• Accéder à vos documents\n• Voir vos badges\n• Postuler à une élection\n• Voter\n\nPosez-moi une question plus précise en utilisant des mots-clés comme "mot de passe", "cotisation", "photo", "profil", "passeport", etc. et je vous guiderai étape par étape !`
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
