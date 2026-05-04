import type { LucideIcon } from "lucide-react";

import type {
  ActiveFanSummary,
  EventAndSupportSummary,
  RoomProfile,
} from "@/lib/showroom";

export type DashboardData = {
  profile: RoomProfile | null;
  activeFan: ActiveFanSummary | null;
  eventAndSupport: EventAndSupportSummary | null;
};

export type DashboardStat = {
  title: string;
  value: string;
  icon: LucideIcon;
};

export type DashboardRealtimeMessage = {
  t?: number | string | null;
};
