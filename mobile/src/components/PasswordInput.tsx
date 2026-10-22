// A password field with an eye button inside it. Tapping the eye shows the
// typed password so a mistyped character can be spotted before submitting.
// The button is a full 44 px target and sits over the field's right edge.
import React, { useState } from "react";
import { Pressable, StyleSheet, TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "./ui";
import { useI18n } from "../i18n";
import { colors, radius } from "../theme";

export function PasswordInput(props: TextInputProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      secureTextEntry={!visible}
      trailing={
        <Pressable
          onPress={() => setVisible((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={visible ? t("Hide password") : t("Show password")}
          accessibilityState={{ selected: visible }}
          hitSlop={4}
          style={({ pressed }) => [styles.eye, pressed ? { opacity: 0.6 } : null]}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={colors.muted}
          />
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  eye: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
