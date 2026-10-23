import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { NewRecordScreen } from "../screens/NewRecordScreen";
import { MyRecordsScreen } from "../screens/MyRecordsScreen";
import { MapScreen } from "../screens/MapScreen";
import { RecordDetailsScreen } from "../screens/RecordDetailsScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { ReviewRecordScreen } from "../screens/ReviewRecordScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { BottomBar } from "../components/BottomBar";
import { LanguageSheet } from "../components/LanguageButton";
import { Sidebar } from "../components/Sidebar";
import { useI18n } from "../i18n";
import { watchNotifications } from "../lib/notifications";
import type { AuthStackParamList, MainTabParamList, RootStackParamList } from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

// The app mark shown in the header: the leaf from the dashboard, not a
// letter in a box.
function HeaderBrand() {
  return (
    <View style={headerStyles.brand}>
      <View style={headerStyles.badge}>
        <Ionicons name="leaf-outline" size={15} color={colors.primary} />
      </View>
      <View>
        <Text style={headerStyles.brandTitle}>Millennia FieldOps</Text>
        <Text style={headerStyles.brandSub}>Millennia Village</Text>
      </View>
    </View>
  );
}

// The panel's door: a plain menu mark, same weight as the other header icons.
function HeaderMenu({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t("Open menu")}
      style={({ pressed }) => [headerStyles.menu, pressed && { opacity: 0.55 }]}
    >
      <Ionicons name="menu" size={24} color={colors.ink} />
    </Pressable>
  );
}

function MainTabs({ navigation }: NativeStackScreenProps<RootStackParamList, "Tabs">) {
  // Watch for reviews while the app is open, and keep the bar badge honest.
  // Uploading is handled by SyncProvider, which also feeds the status badge.
  const { session } = useAuth();
  const { t } = useI18n();
  const userId = session?.user.id ?? null;
  const [unread, setUnread] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }
    return watchNotifications(userId, setUnread);
  }, [userId]);

  function openLanguage() {
    setPanelOpen(false);
    // Let the panel finish leaving before the sheet arrives; two modals
    // overlapping is unreliable on iOS.
    setTimeout(() => setLanguageOpen(true), 240);
  }

  function openReview() {
    setPanelOpen(false);
    navigation.navigate("ReviewQueue");
  }

  function openProfile() {
    setPanelOpen(false);
    navigation.navigate("Profile");
  }

  return (
    <>
      <Tabs.Navigator
        tabBar={(props) => <BottomBar {...props} unread={unread} />}
        screenOptions={{
          headerStyle: { backgroundColor: colors.page },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
          headerTitleAlign: "left",
          headerTitle: () => <HeaderBrand />,
          headerLeft: () => <HeaderMenu onPress={() => setPanelOpen(true)} />,
        }}
      >
        <Tabs.Screen name="Home" component={HomeScreen} options={{ title: t("Home") }} />
        <Tabs.Screen name="Map" component={MapScreen} options={{ title: t("Map") }} />
        <Tabs.Screen name="New" component={NewRecordScreen} options={{ title: t("New record") }} />
        <Tabs.Screen name="Records" component={MyRecordsScreen} options={{ title: t("My records") }} />
        {/* Review is not a tab: it lives in the side panel and opens as a
            normal screen with a back button. */}
        <Tabs.Screen
          name="Alerts"
          component={NotificationsScreen}
          options={{ title: t("Notifications") }}
        />
      </Tabs.Navigator>

      <Sidebar
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onOpenLanguage={openLanguage}
        onOpenReview={openReview}
        onOpenProfile={openProfile}
      />

      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();
  const { t } = useI18n();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.page }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="Register" component={RegisterScreen} />
      </AuthStack.Navigator>
    );
  }

  return (
    <RootStack.Navigator>
      <RootStack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <RootStack.Screen
        name="ReviewQueue"
        component={ReviewScreen}
        options={{
          title: t("Review queue"),
          headerStyle: { backgroundColor: colors.page },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
        }}
      />
      <RootStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t("Profile"),
          headerStyle: { backgroundColor: colors.page },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
        }}
      />
      <RootStack.Screen
        name="RecordDetails"
        component={RecordDetailsScreen}
        options={{
          title: t("Record"),
          headerStyle: { backgroundColor: colors.page },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
        }}
      />
      <RootStack.Screen
        name="ReviewRecord"
        component={ReviewRecordScreen}
        options={{
          title: t("Review record"),
          headerStyle: { backgroundColor: colors.page },
          headerTintColor: colors.ink,
          headerShadowVisible: false,
        }}
      />
    </RootStack.Navigator>
  );
}

const headerStyles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: colors.ink, fontSize: 14, fontWeight: "600", lineHeight: 17 },
  brandSub: { color: colors.muted, fontSize: 11, lineHeight: 13 },
  menu: { paddingHorizontal: 2 },
});
