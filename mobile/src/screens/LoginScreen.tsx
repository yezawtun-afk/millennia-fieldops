import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { Banner, Button, Card, Field, Input } from "../components/ui";
import { colors } from "../theme";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    if (result.error) setError(result.error);
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.title}>Millennia FieldOps</Text>
          <Text style={styles.subtitle}>Field data capture for Millennia Village</Text>
        </View>

        <Card>
          {error ? <Banner kind="error">{error}</Banner> : null}

          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@millennia.my"
            />
          </Field>
          <Field label="Password">
            <Input value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" />
          </Field>

          <Button title="Sign in" onPress={onSubmit} loading={busy} />

          <View style={{ height: 10 }} />
          <Button
            title="Create an account"
            variant="secondary"
            onPress={() => navigation.navigate("Register")}
          />
        </Card>

        <Text style={styles.hint}>
          Accounts created here start as field workers. A supervisor or administrator gives them a
          wider role from the web dashboard.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: 20, paddingTop: 60, flexGrow: 1, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 24 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4 },
  hint: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 18, lineHeight: 18 },
});
