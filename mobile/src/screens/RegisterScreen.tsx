import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { LanguageButton } from "../components/LanguageButton";
import { Banner, Button, Card, Field, Input } from "../components/ui";
import { PasswordInput } from "../components/PasswordInput";
import { colors, spacing, type } from "../theme";
import type { AuthStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!phone.trim()) {
      setError(t("Enter your phone number. It is how you will sign in."));
      return;
    }
    if (password.length < 6) {
      setError(t("Choose a password of at least 6 characters."));
      return;
    }
    // Retyping catches a typo before the request is sent: the account is
    // created with whatever was typed first.
    if (password !== confirmPassword) {
      setError(t("The passwords do not match."));
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);

    const result = await signUp(email, password, fullName, phone);
    setBusy(false);

    if (result.error) {
      setError(t(result.error));
      return;
    }

    setMessage(
      t(
        "Request sent. An administrator will review it, and you can sign in with your phone number once it is approved."
      )
    );
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.languageRow}>
          <LanguageButton />
        </View>

        <Text style={styles.title}>{t("Request an account")}</Text>
        <Text style={styles.subtitle}>
          {t(
            "Your phone number is how you sign in. An administrator reviews every request before it can be used."
          )}
        </Text>

        <Card style={styles.card}>
          {error ? <Banner kind="error">{error}</Banner> : null}
          {message ? <Banner kind="success">{message}</Banner> : null}

          <Field label={t("Full name")}>
            <Input value={fullName} onChangeText={setFullName} placeholder={t("Your name")} />
          </Field>
          <Field label={t("Phone number")}>
            <Input
              value={phone}
              onChangeText={setPhone}
              autoComplete="tel"
              keyboardType="phone-pad"
              placeholder="012-345 6789"
            />
          </Field>
          <Field label={t("Email (optional)")}>
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@millennia.my"
            />
          </Field>
          <Field label={t("Password")}>
            <PasswordInput
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              placeholder={t("At least 6 characters")}
            />
          </Field>
          <Field label={t("Retype password")}>
            <PasswordInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoComplete="new-password"
              placeholder={t("Retype password")}
            />
          </Field>

          <Button title={t("Send request")} onPress={onSubmit} loading={busy} />
          <View style={{ height: spacing.md }} />
          <Button
            title={t("Back to sign in")}
            variant="secondary"
            onPress={() => navigation.goBack()}
          />
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
  languageRow: { position: "absolute", top: spacing.xxl, right: spacing.lg, zIndex: 2 },
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
