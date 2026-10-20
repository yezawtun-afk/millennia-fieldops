import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { NewRecordScreen } from "../screens/NewRecordScreen";
import { MyRecordsScreen } from "../screens/MyRecordsScreen";
import { RecordDetailsScreen } from "../screens/RecordDetailsScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { useAutoUpload } from "../lib/useAutoUpload";
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

// Log out lives in the header, like the "Log out" button on the dashboard.
function HeaderLogout() {
  const { signOut } = useAuth();

  function confirm() {
    Alert.alert("Log out", "Sign out of Millennia FieldOps on this phone?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void signOut();
        },
      },
    ]);
  }

  return (
    <Pressable onPress={confirm} hitSlop={12} accessibilityLabel="Log out" style={headerStyles.logout}>
      <Ionicons name="log-out-outline" size={18} color={colors.muted} />
      <Text style={headerStyles.logoutText}>Log out</Text>
    </Pressable>
  );
}

function MainTabs() {
  // Push anything queued as soon as the phone has a connection again.
  useAutoUpload();

  // Watch for reviews while the app is open, and keep the tab badge honest.
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }
    return watchNotifications(userId, setUnread);
  }, [userId]);

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.page },
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        headerTitleAlign: "left",
        headerTitle: () => <HeaderBrand />,
        headerRight: () => <HeaderLogout />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        tabBarIcon: ({ color, size }) => {
          const name =
            route.name === "Home"
              ? "home-outline"
              : route.name === "New"
                ? "add-circle-outline"
                : route.name === "Records"
                  ? "list-outline"
                  : "notifications-outline";
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
      <Tabs.Screen name="New" component={NewRecordScreen} options={{ title: "New record" }} />
      <Tabs.Screen name="Records" component={MyRecordsScreen} options={{ title: "My records" }} />
      <Tabs.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{
          title: "Notifications",
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.hazard, color: "#FFFFFF", fontSize: 11 },
        }}
      />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { session, loading } = useAuth();

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
        name="RecordDetails"
        component={RecordDetailsScreen}
        options={{
          title: "Record",
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
  logout: { flexDirection: "row", alignItems: "center", gap: 4 },
  logoutText: { color: colors.muted, fontSize: 13, fontWeight: "500" },
});
