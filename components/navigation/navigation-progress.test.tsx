import { Suspense, useState, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NavigationLink } from "./navigation-link";
import { NavigationProgressProvider, useNavigationRouter } from "./navigation-progress";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

const preventDocumentNavigation = (event: MouseEvent) => event.preventDefault();

beforeEach(() => {
  vi.resetAllMocks();
  // Run after React's click handlers; jsdom cannot open documents or tabs.
  window.addEventListener("click", preventDocumentNavigation);
});
afterEach(() => {
  cleanup();
  window.removeEventListener("click", preventDocumentNavigation);
});

function deferredPage() {
  let ready = false;
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return {
    read() { if (!ready) throw promise; },
    resolve() { ready = true; resolve(); },
  };
}

function Destination({ page }: { page: ReturnType<typeof deferredPage> | null }) {
  page?.read();
  return <p>{page ? "遷移後のページ" : "現在のページ"}</p>;
}

function ImperativeButtons() {
  const navigationRouter = useNavigationRouter();
  return (
    <>
      <button onClick={() => navigationRouter.push("/logs")}>ログへ</button>
      <button onClick={() => navigationRouter.replace("/dashboard")}>戻る</button>
      <button onClick={() => navigationRouter.refresh()}>更新する</button>
    </>
  );
}

function renderNavigation(children: ReactNode) {
  const page = deferredPage();
  function Harness() {
    const [destination, setDestination] = useState<typeof page | null>(null);
    router.push.mockImplementation(() => setDestination(page));
    router.replace.mockImplementation(() => setDestination(page));
    router.refresh.mockImplementation(() => setDestination(page));
    return (
      <NavigationProgressProvider>
        {children}
        <Suspense fallback={<p>ページの準備中</p>}>
          <Destination page={destination} />
        </Suspense>
      </NavigationProgressProvider>
    );
  }
  const result = render(<Harness />);
  return { ...result, page };
}

describe("ページ遷移のローディング", () => {
  it.each(["ログへ", "戻る", "更新する"])("%s の遷移完了まで表示を維持する", async (label) => {
    const { page } = renderNavigation(<ImperativeButtons />);
    expect(screen.queryByRole("status")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByRole("status").textContent).toContain("ページを読み込み中");
    expect(screen.getByText("現在のページ")).not.toBeNull();

    await act(async () => page.resolve());
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.getByText("遷移後のページ")).not.toBeNull();
  });

  it("クエリを変更するリンクの遷移とオプションを追跡する", async () => {
    const { page } = renderNavigation(
      <NavigationLink href="/showtube?genre=2" replace scroll={false}>ジャンル</NavigationLink>,
    );
    fireEvent.click(screen.getByRole("link", { name: "ジャンル" }));
    expect(router.replace).toHaveBeenCalledWith("/showtube?genre=2", expect.objectContaining({ scroll: false }));
    expect(screen.getByRole("status")).not.toBeNull();

    await act(async () => page.resolve());
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("クリックしたメニューが閉じても遷移表示を維持する", async () => {
    function Menu() {
      const [isOpen, setIsOpen] = useState(true);
      return isOpen ? <NavigationLink href="/logs" onClick={() => setIsOpen(false)}>メニュー項目</NavigationLink> : null;
    }
    const { page } = renderNavigation(<Menu />);
    fireEvent.click(screen.getByRole("link", { name: "メニュー項目" }));
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("status")).not.toBeNull();

    await act(async () => page.resolve());
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("onNavigateでキャンセルされた遷移は開始しない", () => {
    renderNavigation(<NavigationLink href="/logs" onNavigate={(event) => event.preventDefault()}>キャンセル</NavigationLink>);
    fireEvent.click(screen.getByRole("link"));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }])("修飾キー付きクリック %j は横取りしない", (modifiers) => {
    renderNavigation(<NavigationLink href="/logs">ログ</NavigationLink>);
    fireEvent.click(screen.getByRole("link"), modifiers);
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([
    { href: "https://example.com" },
    { href: "/logs", target: "_blank" },
    { href: "/sample.json", download: true },
  ])("外部・別タブ・ダウンロードのリンク %j は横取りしない", (props) => {
    renderNavigation(<NavigationLink {...props}>リンク</NavigationLink>);
    fireEvent.click(screen.getByRole("link"));
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
