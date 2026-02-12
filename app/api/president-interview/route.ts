import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * Route API pour lire et parser le fichier markdown de l'interview du président
 * Convertit le markdown en sections HTML structurées
 */
export async function GET() {
  try {
    const mdPath = join(process.cwd(), "docs", "interview.md");
    
    if (!existsSync(mdPath)) {
      return NextResponse.json({
        success: false,
        error: "Fichier d'interview non trouvé",
        sections: [],
      });
    }

    // Lire le fichier markdown
    try {
      const markdownContent = await readFile(mdPath, "utf-8");
      
      // Parser le markdown pour extraire les sections
      const sections: Array<{ title: string; content: string }> = [];
      
      // Liste des rubriques attendues
      const expectedRubriques = [
        "Parcours et motivations",
        "Vision et projets",
        "Gouvernance et engagement",
        "Défis et perspectives",
        "Message aux membres"
      ];
      
      // Diviser le markdown par les rubriques (format: "1. Titre" ou "2. Titre", etc.)
      const lines = markdownContent.split('\n');
      let currentSection: { title: string; content: string[] } | null = null;
      let introContent: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Détecter une rubrique (format: "1. Parcours et motivations" ou juste "Parcours et motivations")
        const rubriqueMatch = expectedRubriques.find(r => {
          // Chercher "1. Titre" ou "2. Titre", etc.
          const numberedPattern = new RegExp(`^\\d+\\.\\s*${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          // Ou juste le titre seul
          const titlePattern = new RegExp(`^${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
          return numberedPattern.test(line) || titlePattern.test(line);
        });
        
        if (rubriqueMatch) {
          // Sauvegarder la section précédente
          if (currentSection && currentSection.content.length > 0) {
            sections.push({
              title: currentSection.title,
              content: currentSection.content.join('\n'),
            });
          }
          
          // Nouvelle section
          currentSection = { title: rubriqueMatch, content: [] };
        } else if (currentSection) {
          // Ajouter au contenu de la section courante
          if (line) {
            currentSection.content.push(line);
          }
        } else {
          // Contenu avant la première rubrique = intro
          if (line) {
            introContent.push(line);
          }
        }
      }
      
      // Ajouter l'intro si elle existe
      if (introContent.length > 0) {
        sections.push({
          title: "Interview avec le Nouveau Président d'Amaki France",
          content: introContent.join('\n'),
        });
      }
      
      // Ajouter la dernière section
      if (currentSection && currentSection.content.length > 0) {
        sections.push({
          title: currentSection.title,
          content: currentSection.content.join('\n'),
        });
      }
      
      // Convertir le markdown en HTML pour chaque section
      // Utiliser une conversion simple markdown -> HTML
      const convertMarkdownToHtml = (md: string): string => {
        let html = md;
        
        // Détecter les questions (lignes commençant par "Pouvez-vous", "Qu'est-ce", "Quelles", "Quels", "Quelle", "Comment", "Quel")
        const questionPatterns = [
          /^(Pouvez-vous[^?]*\?)/i,
          /^(Qu'est-ce[^?]*\?)/i,
          /^(Quelles[^?]*\?)/i,
          /^(Quels[^?]*\?)/i,
          /^(Quelle[^?]*\?)/i,
          /^(Comment[^?]*\?)/i,
          /^(Quel[^?]*\?)/i,
          /^(Quelles sont les valeurs)/i,
          /^(Quels sont les projets prioritaires)/i,
          /^(Quelle est votre ambition)/i,
        ];
        
        // Marquer les questions pour traitement ultérieur
        const lines = html.split('\n');
        const processedLines = lines.map(line => {
          const trimmed = line.trim();
          // Vérifier si c'est une question
          for (const pattern of questionPatterns) {
            if (pattern.test(trimmed)) {
              return `QUESTION_MARKER:${trimmed}`;
            }
          }
          return trimmed;
        });
        html = processedLines.join('\n');
        
        // Convertir les puces "•" en listes HTML
        html = html.replace(/^(\s*)•\s+(.+)$/gm, '<li>$2</li>');
        // Grouper les <li> consécutifs en <ul>
        // Traiter ligne par ligne pour grouper les <li> consécutifs
        const htmlLines = html.split('\n');
        let groupedLines: string[] = [];
        let currentList: string[] = [];
        
        for (const line of htmlLines) {
          if (line.trim().startsWith('<li>')) {
            currentList.push(line.trim());
          } else {
            if (currentList.length > 0) {
              groupedLines.push(`<ul>${currentList.join('')}</ul>`);
              currentList = [];
            }
            groupedLines.push(line);
          }
        }
        
        if (currentList.length > 0) {
          groupedLines.push(`<ul>${currentList.join('')}</ul>`);
        }
        
        html = groupedLines.join('\n');
        
        // Convertir les marqueurs de questions en divs stylisées
        html = html.replace(/QUESTION_MARKER:(.+)/g, '<p class="question-text">$1</p>');
        
        // Convertir les paragraphes (lignes non vides, pas déjà HTML)
        html = html.split('\n').map(line => {
          line = line.trim();
          if (!line) return '';
          // Si c'est déjà du HTML (li, ul, p.question-text), ne pas wrapper
          if (line.startsWith('<')) return line;
          return `<p>${line}</p>`;
        }).join('\n');
        
        // Nettoyer les paragraphes vides et doubles
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p>\s*<\/p>/g, '');
        
        return html;
      };
      
      // Convertir chaque section en HTML
      const sectionsWithHtml = sections.map(section => ({
        title: section.title,
        content: convertMarkdownToHtml(section.content),
      }));
      
      return NextResponse.json({
        success: true,
        sections: sectionsWithHtml,
      });
    } catch (mdError: any) {
      console.error("Erreur lors du parsing markdown:", mdError);
      throw mdError;
    }
  } catch (error: any) {
    console.error("Erreur lors de la lecture de l'interview:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erreur lors de la lecture du fichier",
        sections: [],
      },
      { status: 500 }
    );
  }
}
