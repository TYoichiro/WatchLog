import type { AppNotice } from "@/lib/dashboard-notices";
import { NoticeListCard } from "@/components/notices/notice-list-card";

type NoticesCardProps = {
  notices: AppNotice[];
  hasError: boolean;
};

export function NoticesCard({ notices, hasError }: NoticesCardProps) {
  return <NoticeListCard notices={notices} hasError={hasError} />;
}
