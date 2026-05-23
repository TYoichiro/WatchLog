import type { LucideIcon } from "lucide-react";

import type { AppNotice } from "@/lib/dashboard-notices";
import type {
  ActiveFanSummary,
  EventAndSupportSummary,
  RoomProfile,
  RoomStatus,
} from "@/lib/showroom";

export type DashboardData = {
  isAdmin: boolean;
  isPremium: boolean;
  profile: RoomProfile | null;
  activeFan: ActiveFanSummary | null;
  eventAndSupport: EventAndSupportSummary | null;
  notices: AppNotice[];
  noticesHasError: boolean;
};

export type DashboardBffOkPayload = {
  status: "ok" | "is_live";
  isAdmin: boolean;
  isPremium: boolean;
  registeredRoom: { roomId: string; roomUrl: string };
  profile: RoomProfile | null;
  activeFan: ActiveFanSummary | null;
  eventAndSupport: EventAndSupportSummary | null;
  notices: AppNotice[];
  noticesHasError: boolean;
  roomStatus: RoomStatus | null;
};

export type DashboardBffResponse =
  | { status: "no_room" }
  | DashboardBffOkPayload;

export type DashboardStat = {
  title: string;
  value: string;
  icon: LucideIcon;
};

