import type { Metadata } from "next";
import { OnlivePage } from "@/components/onlive/onlive-room-page";

export const metadata: Metadata = {
  title: "配信中 | WatchLog",
};

export default function Page() {
  return <OnlivePage />;
}
