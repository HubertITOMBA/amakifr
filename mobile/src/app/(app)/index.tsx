import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Platform,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useAuth } from "@/auth/auth-context";
import { getMySurveysSummary } from "@/api/sondages";
import { getMyEventsSummary } from "@/api/evenements";
import { getMyElectionsSummary } from "@/api/elections";
import { getMyChatUnreadCount } from "@/api/chat";
import { subscribeChatPushRefresh } from "@/api/push-events";
import {
  HOME_SCROLL_SECTION_ORDER,
  buildHomeHighlightSlides,
  buildHomeMenuItems,
  buildHomeQuickActions,
  homeScrollBottomPadding,
} from "@/features/home/home-model";
import { homeWelcomeMarginTop } from "@/features/home/home-header-layout";
import {
  resolveHeaderStatusInset,
} from "@/features/layout/gradient-header-model";
import { formatDateTimeFr } from "@/utils/profile-helpers";
import { MobileHomeHeader } from "@/components/home/mobile-home-header";
import { WelcomeCard } from "@/components/home/welcome-card";
import { QuickActionCard } from "@/components/home/quick-action-card";
import { HomeHighlightBanner } from "@/components/home/home-highlight-banner";
import { HomeMenuModal } from "@/components/home/home-menu-modal";
import { useUnreadCount } from "@/hooks/unread-count";
import {
  AmakiColors,
  AmakiSpacing,
  AmakiTypography,
} from "@/constants/theme";

/**
 * Accueil V2 — header edge-to-edge, actions compactes, À la une conditionnelle.
 */
export default function AccueilScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useUnreadCount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [surveyCount, setSurveyCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [electionsCount, setElectionsCount] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [nextEventTitle, setNextEventTitle] = useState<string | null>(null);
  const [nextEventWhen, setNextEventWhen] = useState<string | null>(null);

  const quickActions = useMemo(
    () => buildHomeQuickActions(unreadCount, chatUnread),
    [unreadCount, chatUnread]
  );
  const menuItems = useMemo(
    () => buildHomeMenuItems(surveyCount),
    [surveyCount]
  );
  const highlightSlides = useMemo(
    () =>
      buildHomeHighlightSlides({
        electionsCount,
        surveyCount,
        eventsCount,
        nextEventTitle,
        nextEventWhen,
      }),
    [
      electionsCount,
      surveyCount,
      eventsCount,
      nextEventTitle,
      nextEventWhen,
    ]
  );

  const loadSurveySummary = useCallback(async () => {
    try {
      const summary = await getMySurveysSummary();
      setSurveyCount(summary.aCompleterCount);
    } catch {
      setSurveyCount(0);
    }
  }, []);

  const loadEventsSummary = useCallback(async () => {
    try {
      const summary = await getMyEventsSummary();
      const count = summary.upcomingCount;
      setEventsCount(count);
      if (count > 0 && summary.nextEvent) {
        setNextEventTitle(summary.nextEvent.titre);
        setNextEventWhen(formatDateTimeFr(summary.nextEvent.dateDebut));
      } else {
        setNextEventTitle(null);
        setNextEventWhen(null);
      }
    } catch {
      setEventsCount(0);
      setNextEventTitle(null);
      setNextEventWhen(null);
    }
  }, []);

  const loadElectionsSummary = useCallback(async () => {
    try {
      const summary = await getMyElectionsSummary();
      setElectionsCount(summary.aVoterCount);
    } catch {
      setElectionsCount(0);
    }
  }, []);

  const loadChatUnread = useCallback(async () => {
    try {
      const r = await getMyChatUnreadCount();
      setChatUnread(r.count);
    } catch {
      setChatUnread(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSurveySummary();
      void loadEventsSummary();
      void loadElectionsSummary();
      void loadChatUnread();
    }, [
      loadSurveySummary,
      loadEventsSummary,
      loadElectionsSummary,
      loadChatUnread,
    ])
  );

  useEffect(() => {
    return subscribeChatPushRefresh(() => {
      void loadChatUnread();
    });
  }, [loadChatUnread]);

  /** expo-status-bar 57 : pas de props translucent/backgroundColor — API RN Android. */
  useEffect(() => {
    if (Platform.OS === "android") {
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor("transparent");
      RNStatusBar.setBarStyle("light-content");
    }
  }, []);

  const scrollPaddingBottom = homeScrollBottomPadding(insets.bottom);
  const statusInset = resolveHeaderStatusInset(
    insets.top,
    Platform.OS === "android" ? RNStatusBar.currentHeight : null
  );
  /** Chevauchement dégradé plafonné pour ne pas entrer dans les commandes. */
  const welcomeMarginTop = homeWelcomeMarginTop(statusInset);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingBottom: scrollPaddingBottom, flexGrow: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          <View
            style={styles.heroBlock}
            testID={`home-section-${HOME_SCROLL_SECTION_ORDER[0]}`}
          >
            <View style={styles.headerSlot}>
              <MobileHomeHeader
                unreadCount={unreadCount}
                onOpenMenu={() => setMenuOpen(true)}
              />
            </View>
            <View style={[styles.welcomeWrap, { marginTop: welcomeMarginTop }]}>
              <WelcomeCard
                name={user?.name}
                role={user?.role}
                status={user?.status}
              />
            </View>
          </View>

          <View testID={`home-section-${HOME_SCROLL_SECTION_ORDER[1]}`}>
            <Text style={styles.sectionTitle}>Actions rapides</Text>
            <View style={styles.quickGrid}>
              {quickActions.map((action) => (
                <QuickActionCard
                  key={action.id}
                  label={action.label}
                  href={action.href}
                  icon={action.icon}
                  iconColor={action.iconColor}
                  iconBg={action.iconBg}
                  badge={action.badge}
                />
              ))}
            </View>
          </View>

          <View
            style={styles.highlightInFlow}
            testID={`home-section-${HOME_SCROLL_SECTION_ORDER[2]}`}
          >
            <HomeHighlightBanner slides={highlightSlides} />
          </View>
        </ScrollView>

        <HomeMenuModal
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          items={menuItems}
          unreadCount={unreadCount}
          chatUnread={chatUnread}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AmakiColors.background,
  },
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scroll: {
    flex: 1,
    overflow: "visible",
  },
  container: {
    paddingHorizontal: AmakiSpacing.lg,
    overflow: "visible",
  },
  heroBlock: {
    position: "relative",
    overflow: "visible",
    marginHorizontal: -AmakiSpacing.lg,
    marginBottom: AmakiSpacing.lg,
  },
  headerSlot: {
    position: "relative",
    zIndex: 0,
    elevation: 0,
  },
  welcomeWrap: {
    position: "relative",
    zIndex: 10,
    elevation: 12,
    /** marginTop dynamique : homeWelcomeMarginTop(statusInset). */
    marginHorizontal: AmakiSpacing.lg,
    marginBottom: AmakiSpacing.md,
  },
  sectionTitle: {
    ...AmakiTypography.title,
    color: AmakiColors.text,
    marginBottom: AmakiSpacing.md,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: AmakiSpacing.md,
  },
  highlightInFlow: {
    marginTop: AmakiSpacing.md,
    /** Gap tab bar = paddingBottom ScrollView seul (HOME_HIGHLIGHT_TAB_GAP). */
    marginBottom: 0,
  },
});
