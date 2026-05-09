import type { Metadata } from "next";
import { auth, signIn } from "@/auth";
import { LoginScreen } from "@/components/login/login-screen";
import { getLoginNotices, type AppNotice } from "@/lib/dashboard-notices";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "WatchLog",
};

export default async function WatchLogLoginPage() {
  const session = await auth();

  if (session?.user) {
    const registeredRoom = await getUserRegisteredRoom(session.user.id);

    redirect(registeredRoom ? "/dashboard" : "/search");
  }

  async function signInWithGoogle() {
    "use server";

    await signIn("google", {
      redirectTo: "/",
    });
  }

  let loginNotices: AppNotice[] = [];
  let hasNoticesError = false;

  try {
    loginNotices = await getLoginNotices();
  } catch (error) {
    console.error(error);
    hasNoticesError = true;
  }

  return (
    <LoginScreen
      hasNoticesError={hasNoticesError}
      loginNotices={loginNotices}
      signInWithGoogle={signInWithGoogle}
    />
  );
}
