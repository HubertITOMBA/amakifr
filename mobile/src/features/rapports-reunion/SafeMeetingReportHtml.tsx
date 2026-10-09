import { Fragment, useMemo, type ReactNode } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  htmlToPlainText,
  isMeetingReportHtmlOversize,
  sanitizeHref,
  sanitizeMeetingReportHtml,
} from "@/features/rapports-reunion/sanitize-meeting-report-html";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

type Token =
  | { type: "text"; value: string }
  | { type: "open"; tag: string; href?: string }
  | { type: "close"; tag: string }
  | { type: "void"; tag: "br" | "hr" };

function tokenize(sanitizedHtml: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const source = sanitizedHtml;
  while (i < source.length) {
    const lt = source.indexOf("<", i);
    if (lt === -1) {
      tokens.push({ type: "text", value: source.slice(i) });
      break;
    }
    if (lt > i) {
      tokens.push({ type: "text", value: source.slice(i, lt) });
    }
    const gt = source.indexOf(">", lt + 1);
    if (gt === -1) break;
    const raw = source.slice(lt + 1, gt).trim();
    i = gt + 1;
    if (raw.startsWith("/")) {
      tokens.push({
        type: "close",
        tag: raw.slice(1).trim().toLowerCase().split(/\s/)[0] ?? "",
      });
      continue;
    }
    const selfClosing = raw.endsWith("/");
    const core = selfClosing ? raw.slice(0, -1).trim() : raw;
    const spaceIdx = core.search(/\s/);
    const tag = (spaceIdx === -1 ? core : core.slice(0, spaceIdx)).toLowerCase();
    const attrs = spaceIdx === -1 ? "" : core.slice(spaceIdx);
    if (tag === "br" || tag === "hr") {
      tokens.push({ type: "void", tag });
      continue;
    }
    if (tag === "a") {
      const m = attrs.match(/\bhref\s*=\s*"([^"]*)"/i);
      const href = sanitizeHref(m?.[1] ?? "");
      tokens.push({ type: "open", tag: "a", href: href ?? undefined });
      continue;
    }
    tokens.push({ type: "open", tag });
  }
  return tokens;
}

function decodeBasic(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

type InlineStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  linkHref?: string;
};

function openExternalLink(href: string) {
  const safe = sanitizeHref(href);
  if (!safe) return;
  Alert.alert("Ouvrir le lien ?", safe, [
    { text: "Annuler", style: "cancel" },
    {
      text: "Ouvrir",
      onPress: () => {
        const again = sanitizeHref(safe);
        if (!again) return;
        void Linking.openURL(again);
      },
    },
  ]);
}

function renderInline(
  tokens: Token[],
  start: number,
  stopTags: Set<string>
): { nodes: ReactNode[]; next: number } {
  const nodes: ReactNode[] = [];
  let i = start;
  const styleStack: InlineStyle[] = [{}];

  const currentStyle = () => styleStack[styleStack.length - 1] ?? {};

  while (i < tokens.length) {
    const tok = tokens[i];
    if (!tok) break;
    if (tok.type === "close" && stopTags.has(tok.tag)) {
      return { nodes, next: i };
    }
    if (tok.type === "text") {
      const text = decodeBasic(tok.value);
      if (text) {
        const st = currentStyle();
        const key = `t-${i}`;
        if (st.linkHref) {
          const href = st.linkHref;
          nodes.push(
            <Text
              key={key}
              style={[
                styles.inline,
                st.bold && styles.bold,
                st.italic && styles.italic,
                st.underline && styles.underline,
                styles.link,
              ]}
              onPress={() => openExternalLink(href)}
              accessibilityRole="link"
              accessibilityLabel={`Lien ${href}`}
            >
              {text}
            </Text>
          );
        } else {
          nodes.push(
            <Text
              key={key}
              style={[
                styles.inline,
                st.bold && styles.bold,
                st.italic && styles.italic,
                st.underline && styles.underline,
              ]}
            >
              {text}
            </Text>
          );
        }
      }
      i += 1;
      continue;
    }
    if (tok.type === "void" && tok.tag === "br") {
      nodes.push(
        <Text key={`br-${i}`} style={styles.inline}>
          {"\n"}
        </Text>
      );
      i += 1;
      continue;
    }
    if (tok.type === "open") {
      const prev = currentStyle();
      if (tok.tag === "strong" || tok.tag === "b") {
        styleStack.push({ ...prev, bold: true });
      } else if (tok.tag === "em" || tok.tag === "i") {
        styleStack.push({ ...prev, italic: true });
      } else if (tok.tag === "u") {
        styleStack.push({ ...prev, underline: true });
      } else if (tok.tag === "a") {
        styleStack.push({ ...prev, linkHref: tok.href });
      } else {
        // bloc inattendu en inline : stop
        return { nodes, next: i };
      }
      i += 1;
      const inner = renderInline(tokens, i, new Set([tok.tag]));
      nodes.push(<Fragment key={`in-${i}`}>{inner.nodes}</Fragment>);
      i = inner.next;
      if (tokens[i]?.type === "close") {
        i += 1;
      }
      styleStack.pop();
      continue;
    }
    if (tok.type === "close") {
      return { nodes, next: i };
    }
    i += 1;
  }
  return { nodes, next: i };
}

function renderBlocks(tokens: Token[]): ReactNode[] {
  const blocks: ReactNode[] = [];
  let i = 0;
  let listKey = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    if (!tok) break;

    if (tok.type === "text") {
      const text = decodeBasic(tok.value).trim();
      if (text) {
        blocks.push(
          <Text key={`p-loose-${i}`} style={styles.paragraph}>
            {text}
          </Text>
        );
      }
      i += 1;
      continue;
    }

    if (tok.type === "void") {
      if (tok.tag === "hr") {
        blocks.push(<View key={`hr-${i}`} style={styles.hr} />);
      }
      i += 1;
      continue;
    }

    if (tok.type === "open") {
      const tag = tok.tag;
      if (["p", "h1", "h2", "h3", "blockquote", "li"].includes(tag)) {
        i += 1;
        const inner = renderInline(tokens, i, new Set([tag]));
        i = inner.next;
        if (tokens[i]?.type === "close" && (tokens[i] as { tag: string }).tag === tag) {
          i += 1;
        }
        const style =
          tag === "h1"
            ? styles.h1
            : tag === "h2"
              ? styles.h2
              : tag === "h3"
                ? styles.h3
                : tag === "blockquote"
                  ? styles.blockquote
                  : tag === "li"
                    ? styles.li
                    : styles.paragraph;
        blocks.push(
          <Text key={`b-${tag}-${i}`} style={style}>
            {tag === "li" ? "• " : null}
            {inner.nodes}
          </Text>
        );
        continue;
      }
      if (tag === "ul" || tag === "ol") {
        i += 1;
        const items: ReactNode[] = [];
        while (i < tokens.length) {
          const t = tokens[i];
          if (t?.type === "close" && t.tag === tag) {
            i += 1;
            break;
          }
          if (t?.type === "open" && t.tag === "li") {
            i += 1;
            const inner = renderInline(tokens, i, new Set(["li"]));
            i = inner.next;
            if (tokens[i]?.type === "close" && (tokens[i] as { tag: string }).tag === "li") {
              i += 1;
            }
            items.push(
              <Text key={`li-${listKey++}`} style={styles.li}>
                {"• "}
                {inner.nodes}
              </Text>
            );
            continue;
          }
          i += 1;
        }
        blocks.push(
          <View key={`list-${listKey++}`} style={styles.list}>
            {items}
          </View>
        );
        continue;
      }
      // skip unknown open
      i += 1;
      continue;
    }

    i += 1;
  }
  return blocks;
}

type Props = {
  html: string;
};

/**
 * Affiche un HTML TipTap sanitisé en composants React Native (pas de WebView).
 * En cas d’echec de rendu enrichi : fallback texte brut.
 * HTML hors borne : mode oversize (pas de tokenisation, pas de log du contenu).
 */
export function SafeMeetingReportHtml({ html }: Props) {
  const content = useMemo(() => {
    if (isMeetingReportHtmlOversize(html)) {
      return { mode: "oversize" as const };
    }
    try {
      const safe = sanitizeMeetingReportHtml(html);
      if (!safe) {
        return { mode: "empty" as const };
      }
      const tokens = tokenize(safe);
      const blocks = renderBlocks(tokens);
      if (blocks.length === 0) {
        const plain = htmlToPlainText(html);
        return plain
          ? { mode: "plain" as const, plain }
          : { mode: "empty" as const };
      }
      return { mode: "rich" as const, blocks };
    } catch (e) {
      if (
        e instanceof Error &&
        (e.name === "MeetingReportHtmlTooLargeError" ||
          e.message === "MEETING_REPORT_HTML_TOO_LARGE")
      ) {
        return { mode: "oversize" as const };
      }
      const plain = htmlToPlainText(html);
      return plain
        ? { mode: "plain" as const, plain }
        : { mode: "empty" as const };
    }
  }, [html]);

  if (content.mode === "oversize") {
    return (
      <Text
        style={styles.empty}
        accessibilityRole="text"
        accessibilityLabel="Compte rendu trop volumineux"
      >
        Compte rendu trop volumineux
      </Text>
    );
  }

  if (content.mode === "empty") {
    return (
      <Text style={styles.empty} accessibilityRole="text">
        Ce compte rendu ne contient pas de texte affichable.
      </Text>
    );
  }

  if (content.mode === "plain") {
    return (
      <Text style={styles.paragraph} accessibilityRole="text">
        {content.plain}
      </Text>
    );
  }

  return <View style={styles.wrap}>{content.blocks}</View>;
}

/**
 * Bouton lien externe (exporté pour tests accessibility helpers).
 */
export function SafeExternalLinkButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const safe = sanitizeHref(href);
  if (!safe) return null;
  return (
    <Pressable
      onPress={() => openExternalLink(safe)}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={styles.linkHit}
    >
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: AmakiSpacing.sm,
  },
  inline: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
  },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  underline: { textDecorationLine: "underline" },
  link: {
    color: AmakiColors.primary,
    textDecorationLine: "underline",
  },
  linkHit: {
    minHeight: 44,
    justifyContent: "center",
  },
  paragraph: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    lineHeight: 22,
  },
  h1: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    marginTop: AmakiSpacing.sm,
  },
  h2: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    marginTop: AmakiSpacing.sm,
  },
  h3: {
    ...AmakiTypography.heading,
    color: AmakiColors.text,
    fontSize: 16,
    marginTop: AmakiSpacing.xs,
  },
  blockquote: {
    ...AmakiTypography.body,
    color: AmakiColors.textSecondary,
    borderLeftWidth: 3,
    borderLeftColor: AmakiColors.primaryBorder,
    paddingLeft: AmakiSpacing.sm,
    fontStyle: "italic",
  },
  list: {
    gap: 4,
    paddingLeft: AmakiSpacing.xs,
  },
  li: {
    ...AmakiTypography.body,
    color: AmakiColors.text,
    lineHeight: 22,
  },
  hr: {
    height: 1,
    backgroundColor: AmakiColors.border,
    marginVertical: AmakiSpacing.sm,
  },
  empty: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    fontStyle: "italic",
  },
});
