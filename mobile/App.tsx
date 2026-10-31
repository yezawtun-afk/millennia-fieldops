import React, { useMemo } from "react";
import { StatusBar } from "expo-status-bar";
// The saved theme is read before the first screen mounts, which takes a moment.
// Holding the splash until then stops a dark-mode user seeing one white frame.
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { I18nProvider } from "./src/i18n";
import { AuthProvider } from "./src/context/AuthContext";
import { SyncProvider } from "./src/context/SyncContext";
import { ThemeProvider, useTheme } from "./src/lib/useTheme";
import { RootNavigator } from "./src/navigation/RootNavigator";

// Everything that needs the active palette sits inside this shell: React
// Navigation keeps its own copy of the colours (screen backgrounds, header
// tint, the back arrow) and the status bar needs the opposite of the surface
// it floats over.
function Shell() {
  const { colors, isDark } = useTheme();

  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.page,
        // Headers are drawn in the page colour, so a card that matched the
        // default white would flash during transitions.
        card: colors.page,
        text: colors.ink,
        border: colors.line,
        notification: colors.hazard,
      },
    };
  }, [colors, isDark]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
    </NavigationContainer>
  );
}

// Must run at module scope: called from inside a component it would be too late.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <SyncProvider>
                <Shell />
              </SyncProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
