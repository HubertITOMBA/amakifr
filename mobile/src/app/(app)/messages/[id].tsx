import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  getMyConversation,
  markMyConversationRead,
  sendMyMessage,
} from "@/api/chat";
import { chatErrorMessage, formatChatMessageWhen } from "@/api/chat-state";
import { ApiClientError, type MyChatMessageDto } from "@/api/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { SecondaryButton } from "@/components/ui/secondary-button";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Thread conversation — messages + envoi.
 */
export default function ConversationThreadScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = useMemo(() => {
    const raw = params.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.id]);
  const navigation = useNavigation();

  const [title, setTitle] = useState("Conversation");
  const [messages, setMessages] = useState<MyChatMessageDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const sendingLock = useRef(false);

  const load = useCallback(
    async (opts: { page: number; prepend?: boolean; refresh?: boolean }) => {
      if (!id) return;
      if (opts.refresh) setRefreshing(true);
      else if (opts.prepend) setLoadingOlder(true);
      else setLoading(true);
      setError(null);
      try {
        const detail = await getMyConversation(id, {
          page: opts.page,
          limit: 50,
        });
        setTitle(detail.displayTitle);
        navigation.setOptions({ title: detail.displayTitle });
        setHasMore(detail.pagination.hasMore);
        setPage(detail.pagination.page);
        setMessages((prev) => {
          if (opts.prepend) {
            const ids = new Set(prev.map((m) => m.id));
            const older = detail.messages.filter((m) => !ids.has(m.id));
            return [...older, ...prev];
          }
          return detail.messages;
        });
        if (!opts.prepend) {
          void markMyConversationRead(id).catch(() => undefined);
        }
      } catch (e) {
        setError(
          e instanceof ApiClientError
            ? chatErrorMessage(e)
            : "Impossible de charger la conversation"
        );
        if (!opts.prepend) setMessages([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingOlder(false);
      }
    },
    [id, navigation]
  );

  useEffect(() => {
    void load({ page: 1 });
  }, [load]);

  const onSend = async () => {
    if (!id || sendingLock.current) return;
    const content = draft.trim();
    if (!content) return;
    sendingLock.current = true;
    setSending(true);
    setError(null);
    try {
      const r = await sendMyMessage(id, content);
      setDraft("");
      setMessages((prev) => [...prev, r.message]);
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? chatErrorMessage(e)
          : "Échec de l'envoi"
      );
    } finally {
      setSending(false);
      sendingLock.current = false;
    }
  };

  if (loading && messages.length === 0) {
    return <LoadingState />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      {error ? <ErrorBanner message={error} /> : null}
      {hasMore ? (
        <SecondaryButton
          label={loadingOlder ? "Chargement…" : "Messages précédents"}
          disabled={loadingOlder}
          onPress={() => void load({ page: page + 1, prepend: true })}
          style={styles.older}
        />
      ) : null}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load({ page: 1, refresh: true })}
            tintColor={AmakiColors.primary}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun message pour le moment.</Text>
        }
        onContentSizeChange={() => {
          if (page === 1 && messages.length > 0) {
            listRef.current?.scrollToEnd({ animated: false });
          }
        }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.isMine ? styles.bubbleMine : styles.bubbleOther,
            ]}
          >
            {!item.isMine ? (
              <Text style={styles.author}>{item.author.displayName}</Text>
            ) : null}
            <Text
              style={[
                styles.content,
                item.isMine && styles.contentMine,
                item.deleted && styles.deleted,
              ]}
            >
              {item.content}
            </Text>
            <Text style={[styles.meta, item.isMine && styles.metaMine]}>
              {formatChatMessageWhen(item.createdAt)}
              {item.edited && !item.deleted ? " · modifié" : ""}
            </Text>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Écrire un message…"
          placeholderTextColor={AmakiColors.textMuted}
          multiline
          editable={!sending}
        />
        <Pressable
          onPress={() => void onSend()}
          disabled={sending || !draft.trim()}
          style={[
            styles.sendBtn,
            (sending || !draft.trim()) && styles.sendDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
        >
          <Text style={styles.sendLabel}>{sending ? "…" : "Envoyer"}</Text>
        </Pressable>
      </View>
      {/* titre accessible pour a11y */}
      <Text style={styles.srOnly}>{title}</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  older: { margin: AmakiSpacing.sm },
  list: {
    padding: AmakiSpacing.md,
    paddingBottom: AmakiSpacing.lg,
    flexGrow: 1,
  },
  empty: {
    ...AmakiTypography.body,
    color: AmakiColors.textMuted,
    textAlign: "center",
    marginTop: 40,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: AmakiRadius.md,
    padding: AmakiSpacing.sm,
    marginBottom: AmakiSpacing.sm,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: AmakiColors.primary,
  },
  bubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: AmakiColors.surface,
    borderWidth: 1,
    borderColor: AmakiColors.border,
  },
  author: {
    ...AmakiTypography.caption,
    fontWeight: "700",
    color: AmakiColors.textMuted,
    marginBottom: 2,
  },
  content: { ...AmakiTypography.body, color: AmakiColors.text },
  contentMine: { color: AmakiColors.surface },
  deleted: { fontStyle: "italic", opacity: 0.8 },
  meta: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: 4,
    fontSize: 10,
  },
  metaMine: { color: "rgba(255,255,255,0.85)" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: AmakiSpacing.sm,
    padding: AmakiSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: AmakiColors.border,
    backgroundColor: AmakiColors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.md,
    paddingHorizontal: AmakiSpacing.sm,
    paddingVertical: 10,
    color: AmakiColors.text,
  },
  sendBtn: {
    backgroundColor: AmakiColors.primary,
    borderRadius: AmakiRadius.sm,
    paddingHorizontal: AmakiSpacing.md,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.5 },
  sendLabel: {
    ...AmakiTypography.caption,
    color: AmakiColors.surface,
    fontWeight: "700",
  },
  srOnly: { height: 0, width: 0, opacity: 0 },
});
