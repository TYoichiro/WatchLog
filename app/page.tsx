import type { Metadata } from "next";
import { auth, signIn } from "@/auth";
import { NoticeListCard } from "@/components/notices/notice-list-card";
import { Button } from "@/components/ui/button";
import { getLoginNotices, type AppNotice } from "@/lib/dashboard-notices";
import { getUserRegisteredRoom } from "@/lib/user-registered-room";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "WatchLog",
};

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2H21l-6.545 7.48L22 22h-6.828l-5.34-6.99L3.8 22H1l7.012-8.01L2 2h6.9l4.82 6.41L18.244 2z" />
    </svg>
  );
}

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
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center gap-6">
        <section className="w-full rounded-3xl bg-white p-8 text-center shadow-sm sm:p-10">
          <h1 className="text-3xl tracking-tight sm:text-4xl">
            WatchLog
          </h1>

          <div className="mt-6 space-y-3">
            <form action={signInWithGoogle}>
              <Button
                type="submit"
                variant="outline"
                className="h-12 cursor-pointer w-full rounded-2xl border-slate-200 bg-white text-base font-semibold hover:bg-slate-50"
              >
                <span className="mr-3 inline-flex">
                  <GoogleIcon />
                </span>
                Googleでログイン
              </Button>
            </form>

            <Button
              type="button"
              disabled
              className="h-12 w-full rounded-2xl bg-black text-white text-base font-semibold hover:bg-neutral-800"
            >
              <span className="mr-3 inline-flex">
                <XIcon />
              </span>
              Xでログイン（準備中）
            </Button>
          </div>
        </section>

        <NoticeListCard notices={loginNotices} hasError={hasNoticesError} />
      </div>
    </main>
  );
}
