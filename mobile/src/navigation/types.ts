import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { HazardSeverity, RecordType } from "../lib/types";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// A rejected report cannot be edited in place, so "Resubmit" starts a new one
// with the old answers carried over - except the photos, which are usually the
// reason it was sent back. Plain data, so the navigation state stays
// serialisable.
export interface RecordPrefill {
  type: RecordType;
  title?: string | null;
  notes?: string | null;
  zoneId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  speciesName?: string | null;
  growthStage?: string | null;
  healthCondition?: string | null;
  estimatedCount?: number | null;
  hazardType?: string | null;
  severity?: HazardSeverity | null;
  readingType?: string | null;
  readingValue?: number | null;
  readingUnit?: string | null;
  /** The supervisor's comment, so the reason travels with the form. */
  feedback?: string | null;
}

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  New: { type?: RecordType; draftId?: string; prefill?: RecordPrefill } | undefined;
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
  /** Finish an approved hazard: a note and up to 3 after photos. */
  CompleteJob: { id: string };
};

// Tab screens can also navigate to screens in the parent stack.
export type TabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
