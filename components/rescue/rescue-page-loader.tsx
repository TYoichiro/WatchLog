"use client";

import dynamic from "next/dynamic";

const RescuePage = dynamic(
  () => import("@/components/rescue/rescue-page").then((mod) => mod.RescuePage),
  { ssr: false }
);

export { RescuePage };
