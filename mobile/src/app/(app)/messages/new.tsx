import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { createMyConversation, searchMyChatContacts } from "@/api/chat";
import {
  buildPrivateConversationPayload,
  chatErrorMessage,
  conversationThreadHref,
} from "@/api/chat-state";
import { ApiClientError, type MyChatContactDto } from "@/api/types";
import { ErrorBanner } from "@/components/ui/error-banner";
import { LoadingState } from "@/components/ui/loading-state";
import {
  AmakiColors,
  AmakiRadius,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Nouveau message — recherche destinataire lazy (min 2 car.).
 * contact.id = User.id → participantIds.
 */
export default function NewMessageScreen() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MyChatContactDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setItems([]);
      setError(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await searchMyChatContacts(t);
        setItems(r.items);
      } catch (e) {
        setItems([]);
        setError(
          e instanceof ApiClientError
            ? chatErrorMessage(e)
            : "Recherche impossible"
        );
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const onPick = async (contact: MyChatContactDto) => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const payload = buildPrivateConversationPayload(contact.id);
      const r = await createMyConversation(payload);
      router.replace(conversationThreadHref(r.id) as `/messages/${string}`);
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? chatErrorMessage(e)
          : "Impossible de créer la conversation"
      );
      setCreating(false);
    }
  };

  return (
    <View style={styles.root}>
      {error ? <ErrorBanner message={error} /> : null}
      <View style={styles.searchBlock}>
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher un membre"
          placeholderTextColor={AmakiColors.textMuted}
          multiline={false}
          numberOfLines={1}
          textAlignVertical="center"
          autoFocus
          editable={!creating}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Text style={styles.hint}>Saisissez au moins 2 caractères.</Text>
      </View>
      {loading ? <LoadingState /> : null}
      {!loading && q.trim().length >= 2 && items.length === 0 ? (
        <Text style={styles.empty}>Aucun contact trouvé.</Text>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => void onPick(item)}
            disabled={creating}
            accessibilityRole="button"
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.displayName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.name}>{item.displayName}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AmakiColors.background },
  searchBlock: {
    marginHorizontal: AmakiSpacing.md,
    marginTop: AmakiSpacing.md,
    marginBottom: AmakiSpacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: AmakiColors.border,
    borderRadius: AmakiRadius.md,
    paddingHorizontal: AmakiSpacing.sm,
    paddingVertical: 12,
    height: 48,
    color: AmakiColors.text,
    backgroundColor: AmakiColors.surface,
    fontSize: 16,
    lineHeight: 20,
    includeFontPadding: false,
  },
  hint: {
    ...AmakiTypography.caption,
    color: AmakiColors.textMuted,
    marginTop: 6,
  },
  empty: {
    ...AmakiTypography.body,
    color: AmakiColors.textMuted,
    textAlign: "center",
    marginTop: AmakiSpacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: AmakiSpacing.sm,
    paddingHorizontal: AmakiSpacing.md,
    paddingVertical: AmakiSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AmakiColors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AmakiColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: AmakiColors.surface, fontWeight: "700" },
  name: {
    ...AmakiTypography.body,
    fontWeight: "600",
    color: AmakiColors.text,
  },
});
