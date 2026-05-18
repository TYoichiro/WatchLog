"use client";

import { useEffect, useState } from "react";

import type { RoomUserProfile } from "@/lib/showroom";

export type ProfileTarget = {
  userId: string;
  userName: string;
};

export type ProfileView = "user" | "room";

type UserProfileResponse = {
  profile: RoomUserProfile;
};

export function useUserProfile(roomId: string) {
  const [target, setTarget] = useState<ProfileTarget | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, RoomUserProfile>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [view, setView] = useState<ProfileView>("user");

  const profile = target ? (profileCache[target.userId] ?? null) : null;

  useEffect(() => {
    if (!target || profile) {
      return;
    }

    const currentTarget = target;
    const controller = new AbortController();

    async function loadProfile() {
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await fetch(
          `/api/room/user-profile?room_id=${encodeURIComponent(roomId)}&user_id=${encodeURIComponent(currentTarget.userId)}`,
          { cache: "no-store", signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch user profile");
        }

        const data = (await response.json()) as UserProfileResponse;
        setProfileCache((current) => ({
          ...current,
          [currentTarget.userId]: data.profile,
        }));
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();

    return () => controller.abort();
  }, [profile, roomId, target]);

  const openProfile = (userId: string, userName: string) => {
    setHasError(false);
    setView("user");
    setTarget({ userId, userName });
  };

  const closeProfile = () => {
    setTarget(null);
    setHasError(false);
    setIsLoading(false);
    setView("user");
  };

  return {
    closeProfile,
    hasError,
    isLoading,
    openProfile,
    profile,
    setView,
    target,
    view,
  };
}
