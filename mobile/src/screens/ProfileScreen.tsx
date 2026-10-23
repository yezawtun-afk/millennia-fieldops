// Your own account.
//
// Two things only: the display name, and the password. Everything else on the
// profile row (role, status, email, phone) is either decided by an
// administrator or is a way to sign in, so it is shown read-only. The database
// enforces that too: protect_columns restores anything except full_name.
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import { changePassword, updateDisplayName } from "../lib/api";
import { formatDate, ROLE_LABELS } from "../lib/format";
import { Banner, Button, Card, Input, ListRow, Pill, SectionTitle } from "../components/ui";
import { PasswordInput } from "../components/PasswordInput";
import { colors, radius, spacing, type } from "../theme";

const MIN_PASSWORD = 8;

type Notice = { kind: "success" | "error"; text: string } | null;

export function ProfileScreen() {
  const { profile, session, refreshProfile } = useAuth();
  const { t } = useI18n();

  const [name, setName] = useState(profile?.full_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameNotice, setNameNotice] = useState<Notice>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null);

  // The cached profile can arrive a moment after the screen; keep the field in
  // step until the person starts editing it.
  useEffect(() => {
    setName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  const trimmedName = name.trim();
  const currentName = (profile?.full_name ?? "").trim();
  const nameChanged = trimmedName !== currentName;
  const canSaveName = nameChanged && trimmedName.length >= 2 && !savingName;

  const mismatch = confirm.length > 0 && confirm !== password;

  const initial = (profile?.full_name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const role = profile ? t(ROLE_LABELS[profile.role]) : "";
  const status = profile?.status ?? "approved";

  async function saveName() {
    if (!session || !canSaveName) return;
    setSavingName(true);
    setNameNotice(null);
    try {
      await updateDisplayName(session.user.id, trimmedName);
      await refreshProfile();
      setNameNotice({ kind: "success", text: t("Name updated") });
    } catch {
      setNameNotice({
        kind: "error",
        text: t("Could not save your name. Try again."),
      });
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    if (savingPassword) return;
    setPasswordNotice(null);

    if (password.length < MIN_PASSWORD) {
      setPasswordNotice({
        kind: "error",
        text: t("Your password must be at least 8 characters."),
      });
      return;
    }
    if (password !== confirm) {
      setPasswordNotice({ kind: "error", text: t("Passwords do not match") });
      return;
    }

    setSavingPassword(true);
    const result = await changePassword(password);
    setSavingPassword(false);

    if (result.error) {
      setPasswordNotice({
        kind: "error",
        text: t("Could not change your password. Try again."),
      });
      return;
    }

    setPassword("");
    setConfirm("");
    setPasswordNotice({ kind: "success", text: t("Password updated") });
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{profile?.full_name ?? ""}</Text>
          <View style={styles.pills}>
            {role ? (
              <Pill
                label={role}
                color={colors.primaryDark}
                background={colors.primarySoft}
                icon={
                  <Ionicons name="person-outline" size={13} color={colors.primaryDark} />
                }
              />
            ) : null}
            {status === "approved" ? (
              <Pill
                label={t("Approved")}
                color={colors.approvedInk}
                background={colors.approvedSoft}
                icon={
                  <Ionicons
                    name="checkmark-circle"
                    size={13}
                    color={colors.approvedInk}
                  />
                }
              />
            ) : null}
          </View>
        </View>

        <SectionTitle>{t("Account")}</SectionTitle>
        <View style={styles.titleGap} />
        <Card>
          <ListRow title={t("Email")} meta={profile?.email ?? "—"} />
          <ListRow
            title={t("Phone")}
            meta={profile?.phone?.trim() || t("Not set")}
          />
          <ListRow
            title={t("Member since")}
            meta={formatDate(profile?.created_at)}
            last
          />
        </Card>
        <Text style={styles.note}>
          {t("Ask an administrator to change your phone number or role.")}
        </Text>

        <View style={styles.gap} />

        <SectionTitle>{t("Display name")}</SectionTitle>
        <View style={styles.titleGap} />
        <Card padded>
          <Input
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (nameNotice) setNameNotice(null);
            }}
            placeholder={t("Enter your name")}
            accessibilityLabel={t("Display name")}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={60}
            returnKeyType="done"
          />
          <Text style={styles.hint}>
            {t("This name appears on the records you submit.")}
          </Text>

          {nameNotice ? (
            <View style={styles.notice}>
              <Banner kind={nameNotice.kind}>{nameNotice.text}</Banner>
            </View>
          ) : null}

          <Button
            title={t("Save")}
            onPress={() => void saveName()}
            disabled={!canSaveName}
            loading={savingName}
          />
        </Card>

        <View style={styles.gap} />

        <SectionTitle>{t("Password")}</SectionTitle>
        <View style={styles.titleGap} />
        <Card padded>
          <Text style={styles.fieldLabel}>{t("New password")}</Text>
          <PasswordInput
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (passwordNotice) setPasswordNotice(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder={t("Use at least 8 characters")}
          />

          <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
            {t("Confirm password")}
          </Text>
          <PasswordInput
            value={confirm}
            onChangeText={(value) => {
              setConfirm(value);
              if (passwordNotice) setPasswordNotice(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder={t("Type it again")}
          />

          {mismatch ? (
            <Text style={styles.mismatch}>{t("Passwords do not match")}</Text>
          ) : null}

          {passwordNotice ? (
            <View style={styles.notice}>
              <Banner kind={passwordNotice.kind}>{passwordNotice.text}</Banner>
            </View>
          ) : null}

          <Button
            title={t("Change password")}
            onPress={() => void savePassword()}
            disabled={password.length === 0 || confirm.length === 0}
            loading={savingPassword}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  identity: { alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 28, fontWeight: "700", color: colors.primaryDark },
  name: { ...type.title, fontSize: 22, textAlign: "center" },
  pills: { flexDirection: "row", gap: 6, marginTop: spacing.sm },

  note: { ...type.caption, marginTop: spacing.sm, lineHeight: 17 },
  hint: { ...type.caption, lineHeight: 17, marginTop: 6, marginBottom: spacing.md },
  notice: { marginTop: spacing.md, marginBottom: spacing.md },
  mismatch: { ...type.caption, color: colors.rejectedInk, marginTop: 6, marginBottom: spacing.md },
  gap: { height: spacing.xl },
  titleGap: { height: 6 },

  fieldLabel: { ...type.label, marginBottom: 6 },
  fieldLabelSpaced: { marginTop: spacing.md },
});
