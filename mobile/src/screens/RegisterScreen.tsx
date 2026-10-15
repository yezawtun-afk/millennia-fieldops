import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { Banner, Button, Card, Field, Input } from "../components/ui";
import { colors } from "../theme";
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
    // Signed up and signed in: the navigator will switch automatically.
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>Join Millennia FieldOps as a field worker.</Text>

        <Card>
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
              keyboardType="email-address"
              placeholder="you@millennia.my"
            />
          </Field>
          <Field label="Password">
            <Input value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" />
          </Field>

          <Button title="Sign up" onPress={onSubmit} loading={busy} />
          <View style={{ height: 10 }} />
          <Button title="Back to sign in" variant="secondary" onPress={() => navigation.goBack()} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: { padding: 20, paddingTop: 60, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink, textAlign: "center" },
  subtitle: { fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 4, marginBottom: 20 },
});
