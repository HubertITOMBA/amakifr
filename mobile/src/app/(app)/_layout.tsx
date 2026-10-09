import { Tabs } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmakiStackHeader } from "@/components/layout/amaki-stack-header";
import { TabBarIcon } from "@/components/tab-bar-icon";
import { formatTabUnreadBadge } from "@/api/notifications-state";
import { AmakiColors } from "@/constants/theme";
import { UnreadCountProvider, useUnreadCount } from "@/hooks/unread-count";
import { PushNotificationsBootstrap } from "@/hooks/push-notifications-bootstrap";

function AppTabs() {
  const insets = useSafeAreaInsets();
  const { unreadCount, refreshUnreadCount } = useUnreadCount();
  const tabBarHeight = 64 + Math.max(insets.bottom, 8);
  const badge = formatTabUnreadBadge(unreadCount);

  return (
    <Tabs
      screenOptions={{
        header: (props) => <AmakiStackHeader {...props} />,
        headerTintColor: AmakiColors.surface,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: AmakiColors.background },
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
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.homeIconWrap,
                focused ? styles.homeIconActive : styles.homeIconIdle,
              ]}
            >
              <TabBarIcon
                name="home"
                color={focused ? AmakiColors.surface : AmakiColors.primary}
              />
            </View>
          ),
          tabBarButton: (props) => (
            <Pressable
              accessibilityRole={props.accessibilityRole}
              accessibilityState={props.accessibilityState}
              accessibilityLabel={props.accessibilityLabel}
              testID={props.testID}
              onPress={props.onPress}
              onLongPress={props.onLongPress}
              style={styles.homeTabButton}
            >
              {props.children}
            </Pressable>
          ),
        }}
        listeners={{
          focus: () => {
            void refreshUnreadCount();
          },
        }}
      />
      <Tabs.Screen
        name="cotisations"
        options={{
          title: "Mes cotisations",
          tabBarLabel: "Cotisations",
          tabBarIcon: ({ color }) => (
            <TabBarIcon name="cotisations" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarBadge: badge,
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
          focus: () => {
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
        name="cotisations-historique"
        options={{
          title: "Historique des paiements",
          href: null,
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
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="reunions-host"
        options={{
          title: "Accueillir une réunion",
          href: null,
        }}
      />
      <Tabs.Screen
        name="evenements"
        options={{
          title: "Événements",
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="sondages"
        options={{
          title: "Mes sondages",
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="elections"
        options={{
          title: "Élections",
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          href: null,
          headerShown: false,
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
      <PushNotificationsBootstrap>
        <AppTabs />
      </PushNotificationsBootstrap>
    </UnreadCountProvider>
  );
}

const styles = StyleSheet.create({
  homeTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  homeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -10,
  },
  homeIconActive: {
    backgroundColor: AmakiColors.primary,
    shadowColor: "#0f172a",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  homeIconIdle: {
    backgroundColor: AmakiColors.primarySoft,
    borderWidth: 1,
    borderColor: AmakiColors.primaryBorder,
  },
});
