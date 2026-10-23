import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RecordType } from "../lib/types";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  New: { type?: RecordType; draftId?: string } | undefined;
  Records: undefined;
  Alerts: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  /** The supervisor queue: opened from Home and the side panel, not a tab. */
  ReviewQueue: undefined;
  /** Your own account: opened from the side panel's identity card. */
  Profile: undefined;
  RecordDetails: { id: string };
  ReviewRecord: { id: string };
};

// Tab screens can also navigate to screens in the parent stack.
export type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
