import React from "react";
import { ActivityIndicator, View } from "react-native";
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
import type { AuthStackParamList, MainTabParamList, RootStackParamList } from "./types";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.forest },
        headerTintColor: "#FFFFFF",
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
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
      <Tabs.Screen name="Alerts" component={NotificationsScreen} options={{ title: "Notifications" }} />
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
          title: "Record details",
          headerStyle: { backgroundColor: colors.forest },
          headerTintColor: "#FFFFFF",
        }}
      />
    </RootStack.Navigator>
  );
}
