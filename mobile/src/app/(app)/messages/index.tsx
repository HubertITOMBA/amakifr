import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getMyChatUnreadCount, getMyConversations } from "@/api/chat";
import { chatErrorMessage, formatChatListWhen } from "@/api/chat-state";
import { subscribeChatPushRefresh } from "@/api/push-events";
import {
  beginLoad,
  createLoadGuard,
  shouldApplyLoadResult,
  type LoadGuard,
} from "@/api/load-guard";
import { ApiClientError, type MyChatConversationListItemDto } from "@/api/types";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Liste conversations — Messages.
 */
export default function MessagesListScreen() {
  const [items, setItems] = useState<MyChatConversationListItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardRef = useRef<LoadGuard>(createLoadGuard());
  const limit = 20;

  const loadPage = useCallback(
    async (opts: {
      refresh?: boolean;
      append?: boolean;
      currentLength: number;
    }) => {
      const started = beginLoad(guardRef.current);
      guardRef.current = started.guard;
      const gen = started.gen;
      const offset = opts.append ? opts.currentLength : 0;

      if (opts.refresh) setRefreshing(true);
      else if (opts.append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const [page, badge] = await Promise.all([
          getMyConversations({ limit, offset }),
          getMyChatUnreadCount().catch(() => ({ count: 0 })),
        ]);
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        setTotal(page.total);
        setUnread(badge.count);
        setItems((prev) =>
          opts.append ? [...prev, ...page.items] : page.items
        );
      } catch (e) {
        if (!shouldApplyLoadResult(gen, guardRef.current.dataGen)) return;
        setError(
          e instanceof ApiClientError
            ? chatErrorMessage(e)
            : "Impossible de charger les messages"
        );
        if (!opts.append) setItems([]);
      } finally {
        if (shouldApplyLoadResult(gen, guardRef.current.dataGen)) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void loadPage({ currentLength: 0 });
    }, [loadPage])
  );

  // Push Chat reçu / retour foreground pendant que la liste est montée
  useEffect(() => {
    return subscribeChatPushRefresh(() => {
      void loadPage({ refresh: true, currentLength: 0 });
    });
  }, [loadPage]);

  if (loading && items.length === 0) {
    return <LoadingState />;
  }

  return (
    <View style={styles.root}>
      {error ? <ErrorBanner message={error} /> : null}
      {unread > 0 ? (
        <Text style={styles.badgeHint}>
          {unread} notification{unread > 1 ? "s" : ""} de message non lue
          {unread > 1 ? "s" : ""}
        </Text>
      ) : null}
      <PrimaryButton
        label="Nouveau message"
        onPress={() => router.push("/messages/new")}
        style={styles.newBtn}
      />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadPage({ refresh: true, currentLength: 0 })}
            tintColor={AmakiColors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucun message"
            message="Aucune conversation pour le moment."
          />
        }
        ListFooterComponent={
          items.length < total ? (
            <SecondaryButton
              label={loadingMore ? "Chargement…" : "Voir plus"}
              disabled={loadingMore}
              onPress={() =>
                void loadPage({ append: true, currentLength: items.length })
              }
              style={styles.more}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, item.unreadCount > 0 && styles.rowUnread]}
            onPress={() => router.push(`/messages/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={item.displayTitle}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.displayTitle.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.displayTitle}
                </Text>
                <Text style={styles.when}>
                  {formatChatListWhen(item.lastMessageAt)}
                </Text>
              </View>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessagePreview || "Aucun message pour le moment."}
              </Text>
            </View>
            {item.unreadCount > 0 ? (
              <View style={styles.dot}>
                <Text style={styles.dotText}>
                  {item.unreadCount > 99 ? "99+" : item.unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  badgeHint: {
    ...AmakiTypography.caption,
    color: AmakiColors.primary,
    fontWeight: "600",
    paddingHorizontal: AmakiSpacing.md,
    paddingTop: AmakiSpacing.sm,
  },
  newBtn: { margin: AmakiSpacing.md, marginBottom: AmakiSpacing.sm },
  list: { paddingHorizontal: AmakiSpacing.md, paddingBottom: AmakiSpacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: AmakiSpacing.sm,
    paddingVertical: AmakiSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AmakiColors.border,
  },
  rowUnread: { backgroundColor: "#eff6ff" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AmakiColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: AmakiColors.surface, fontWeight: "700", fontSize: 16 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: AmakiSpacing.sm,
  },
  title: {
    ...AmakiTypography.body,
    fontWeight: "700",
    color: AmakiColors.text,
    flex: 1,
  },
  when: { ...AmakiTypography.caption, color: AmakiColors.textMuted },
  preview: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: 2,
  },
  dot: {
    minWidth: 22,
    height: 22,
    borderRadius: AmakiRadius.sm,
    backgroundColor: AmakiColors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  dotText: { color: AmakiColors.surface, fontSize: 11, fontWeight: "700" },
  more: { marginVertical: AmakiSpacing.md },
});
