import { toJstWallTimeIsoString } from "@/lib/jst";

export type MaintenanceWindowListItem = {
  id: string;
  title: string;
  message: string | null;
  startsAt: Date;
  endsAt: Date;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const maintenanceWindowSelect = {
  id: true,
  title: true,
  message: true,
  startsAt: true,
  endsAt: true,
  isEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function serializeWindow(w: MaintenanceWindowListItem) {
  return {
    id: w.id,
    title: w.title,
    message: w.message,
    startsAt: toJstWallTimeIsoString(w.startsAt),
    endsAt: toJstWallTimeIsoString(w.endsAt),
    isEnabled: w.isEnabled,
    createdAt: toJstWallTimeIsoString(w.createdAt),
    updatedAt: toJstWallTimeIsoString(w.updatedAt),
  };
}
