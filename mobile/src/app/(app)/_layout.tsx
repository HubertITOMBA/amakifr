import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBarIcon } from "@/components/tab-bar-icon";
import { AmakiColors } from "@/constants/theme";
import { UnreadCountProvider, useUnreadCount } from "@/hooks/unread-count";

function AppTabs() {
  const insets = useSafeAreaInsets();
  const { unreadCount, refreshUnreadCount } = useUnreadCount();
  const tabBarHeight = 56 + Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: AmakiColors.primary },
        headerTintColor: AmakiColors.surface,
        headerTitleStyle: { fontWeight: "600" },
        tabBarActiveTintColor: AmakiColors.primary,
        tabBarInactiveTintColor: AmakiColors.textMuted,
        tabBarStyle: {
          backgroundColor: AmakiColors.surface,
          borderTopColor: AmakiColors.border,
          height: tabBarHeight,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cotisations"
        options={{
          title: "Cotisations",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="cotisations" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: AmakiColors.danger,
            color: AmakiColors.surface,
            fontSize: 10,
          },
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="notifications" color={color} />
          ),
        }}
        listeners={{
          blur: () => {
            void refreshUnreadCount();
          },
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="profil" color={color} />,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: "Documents",
          href: null,
        }}
      />
      <Tabs.Screen
        name="passeport"
        options={{
          title: "Mon passeport",
          href: null,
        }}
      />
      <Tabs.Screen
        name="taches"
        options={{
          title: "Mes tâches",
          href: null,
        }}
      />
      <Tabs.Screen
        name="reunions"
        options={{
          title: "Les réunions",
          href: null,
        }}
      />
      <Tabs.Screen
        name="reunions-host"
        options={{
          title: "Accueillir une réunion",
          href: null,
        }}
      />
    </Tabs>
  );
}

/**
 * Zone authentifiée — bottom tabs Accueil / Cotisations / Notifications / Profil.
 */
export default function AppLayout() {
  return (
    <UnreadCountProvider>
      <AppTabs />
    </UnreadCountProvider>
  );
}
