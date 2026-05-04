import { APP_TIME_ZONE } from "@/lib/jst";

export const POSTGRES_TIME_ZONE_OPTION = `-c timezone=${APP_TIME_ZONE}`;

export function configureServerTimeZone() {
  process.env.TZ = APP_TIME_ZONE;
}

configureServerTimeZone();
