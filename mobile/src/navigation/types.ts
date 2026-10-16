import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RecordType } from "../lib/types";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  New: { type?: RecordType; draftId?: string } | undefined;
  Records: undefined;
  Alerts: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  RecordDetails: { id: string };
};

// Tab screens can also navigate to screens in the parent stack.
export type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
