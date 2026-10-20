import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { Banner, Button, Card, Field, Input } from "../components/ui";
import { colors, spacing, type } from "../theme";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (password.length < 6) {
      setError("Choose a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);

    const result = await signUp(email, password, fullName);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setMessage("Check your email to confirm the account, then sign in.");
      return;
    }
    // Signed up and signed in: the navigator switches automatically.
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>Join as a field worker. Your supervisor can change the role.</Text>

        <Card style={styles.card}>
          {error ? <Banner kind="error">{error}</Banner> : null}
          {message ? <Banner kind="success">{message}</Banner> : null}

          <Field label="Full name">
            <Input value={fullName} onChangeText={setFullName} placeholder="Your name" />
          </Field>
          <Field label="Email">
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@millennia.my"
            />
          </Field>
          <Field label="Password">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
          </Field>

          <Button title="Sign up" onPress={onSubmit} loading={busy} />
          <View style={{ height: spacing.md }} />
          <Button title="Back to sign in" variant="secondary" onPress={() => navigation.goBack()} />
        </Card>
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
  title: { ...type.title, fontSize: 22, textAlign: "center" },
  subtitle: {
    ...type.subhead,
    textAlign: "center",
    marginTop: 3,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  card: { padding: spacing.lg },
});
