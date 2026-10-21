import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { Banner, Button, Card, Field, Input } from "../components/ui";
import { colors, radius, spacing, type } from "../theme";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    const result = await signIn(identifier, password);
    if (result.error) setError(result.error);
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.mark}>
            <Ionicons name="leaf-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.title}>Millennia FieldOps</Text>
          <Text style={styles.subtitle}>Millennia Village · field data capture</Text>
        </View>

        <Card style={styles.card}>
          {error ? <Banner kind="error">{error}</Banner> : null}

          <Field label="Email or phone number">
            <Input
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoComplete="username"
              keyboardType="default"
              placeholder="you@millennia.my or 012-345 6789"
            />
          </Field>
          <Field label="Password">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="Your password"
            />
          </Field>

          <Button title="Sign in" onPress={onSubmit} loading={busy} />

          <View style={{ height: spacing.md }} />
          <Button
            title="Request an account"
            variant="secondary"
            onPress={() => navigation.navigate("Register")}
          />
        </Card>

        <Text style={styles.hint}>
          New accounts are reviewed by an administrator before they can sign in. You join as a
          field worker; a supervisor or administrator widens the role from the web dashboard.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
    justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: spacing.xl },
  mark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderCurve: "continuous",
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { ...type.title, fontSize: 22 },
  subtitle: { ...type.subhead, marginTop: 3 },
  card: { padding: spacing.lg },
  hint: {
    ...type.caption,
    textAlign: "center",
    marginTop: spacing.lg,
    lineHeight: 17,
    paddingHorizontal: spacing.md,
  },
});
