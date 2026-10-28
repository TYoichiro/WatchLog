"use client";

import {
  createContext,
  startTransition,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Router = ReturnType<typeof useRouter>;
type NavigationOptions = NonNullable<Parameters<Router["push"]>[1]> & {
  replace?: boolean;
};

const NavigationContext = createContext<{
  navigate: (href: string, options: NavigationOptions) => void;
  runNavigation: (action: () => void) => void;
} | null>(null);

export function NavigationProgressProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, runNavigation] = useTransition();
  const value = useMemo(() => ({
    runNavigation,
    navigate(href: string, { replace, ...options }: NavigationOptions) {
      runNavigation(() => {
        if (replace) {
          router.replace(href, options);
        } else {
          router.push(href, options);
        }
      });
    },
  }), [router, runNavigation]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
      {isPending ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4"
        >
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-lg">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ページを読み込み中...
          </div>
        </div>
      ) : null}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}

// Track the entire router transition, including refreshes after an API response.
export function useNavigationRouter(): Router {
  const router = useRouter();
  const navigation = useNavigation();
  const runNavigation = navigation?.runNavigation ?? startTransition;

  return useMemo(() => ({
    ...router,
    push: (...args: Parameters<Router["push"]>) => runNavigation(() => router.push(...args)),
    replace: (...args: Parameters<Router["replace"]>) => runNavigation(() => router.replace(...args)),
    refresh: () => runNavigation(() => router.refresh()),
  }), [router, runNavigation]);
}
