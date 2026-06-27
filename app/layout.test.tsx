import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RootLayout from "./layout";

const {
  authMock,
  getActiveMaintenanceWindowMock,
  headersMock,
  prismaUserFindUniqueMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getActiveMaintenanceWindowMock: vi.fn(),
  headersMock: vi.fn(),
  prismaUserFindUniqueMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("./globals.css", () => ({}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: prismaUserFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/maintenance", () => ({
  getActiveMaintenanceWindow: getActiveMaintenanceWindowMock,
}));

vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => null,
}));

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("geist/font/sans", () => ({
  GeistSans: { variable: "font-geist-sans" },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) =>
    args.filter((a) => typeof a === "string" && a).join(" "),
}));

function makeHeaders(pathname: string) {
  return { get: (key: string) => (key === "x-watchlog-pathname" ? pathname : null) };
}

const maintenanceWindow = {
  id: "mw-1",
  title: "定期メンテナンス",
  message: null,
  startsAt: new Date("2026-06-27T01:00:00+09:00"),
  endsAt: new Date("2026-06-27T03:00:00+09:00"),
  period: "2026/06/27（土）01:00〜2026/06/27（土）03:00",
};

afterEach(() => {
  cleanup();
  authMock.mockReset();
  getActiveMaintenanceWindowMock.mockReset();
  headersMock.mockReset();
  prismaUserFindUniqueMock.mockReset();
  redirectMock.mockClear();
});

describe("RootLayout — メンテナンスリダイレクト", () => {
  it("メンテナンスウィンドウがあり /maintenance 以外のパスでは /maintenance にリダイレクトする", async () => {
    headersMock.mockResolvedValue(makeHeaders("/dashboard"));
    getActiveMaintenanceWindowMock.mockResolvedValue(maintenanceWindow);

    await expect(RootLayout({ children: <div /> })).rejects.toThrow(
      "NEXT_REDIRECT:/maintenance",
    );
    expect(redirectMock).toHaveBeenCalledWith("/maintenance");
  });

  it("メンテナンスウィンドウがあっても /maintenance パスではリダイレクトしない", async () => {
    headersMock.mockResolvedValue(makeHeaders("/maintenance"));
    getActiveMaintenanceWindowMock.mockResolvedValue(maintenanceWindow);
    authMock.mockResolvedValue(null);

    render(await RootLayout({ children: <div data-testid="child" /> }));

    expect(screen.getByTestId("child")).not.toBeNull();
    expect(redirectMock).not.toHaveBeenCalledWith("/maintenance");
  });

  it("メンテナンスウィンドウがない場合は /maintenance にリダイレクトしない", async () => {
    headersMock.mockResolvedValue(makeHeaders("/dashboard"));
    getActiveMaintenanceWindowMock.mockResolvedValue(null);
    authMock.mockResolvedValue(null);

    render(await RootLayout({ children: <div data-testid="child" /> }));

    expect(screen.getByTestId("child")).not.toBeNull();
    expect(redirectMock).not.toHaveBeenCalledWith("/maintenance");
  });
});

describe("RootLayout — BANユーザーリダイレクト", () => {
  it("ログイン中のBANユーザーは /banned にリダイレクトされる", async () => {
    headersMock.mockResolvedValue(makeHeaders("/dashboard"));
    getActiveMaintenanceWindowMock.mockResolvedValue(null);
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaUserFindUniqueMock.mockResolvedValue({ isBanned: true });

    await expect(RootLayout({ children: <div /> })).rejects.toThrow(
      "NEXT_REDIRECT:/banned",
    );
    expect(redirectMock).toHaveBeenCalledWith("/banned");
  });

  it("BANされていないユーザーはリダイレクトされない", async () => {
    headersMock.mockResolvedValue(makeHeaders("/dashboard"));
    getActiveMaintenanceWindowMock.mockResolvedValue(null);
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    prismaUserFindUniqueMock.mockResolvedValue({ isBanned: false });

    render(await RootLayout({ children: <div data-testid="child" /> }));

    expect(screen.getByTestId("child")).not.toBeNull();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("未ログインの場合はBANチェックをせずに children を表示する", async () => {
    headersMock.mockResolvedValue(makeHeaders("/dashboard"));
    getActiveMaintenanceWindowMock.mockResolvedValue(null);
    authMock.mockResolvedValue(null);

    render(await RootLayout({ children: <div data-testid="child" /> }));

    expect(prismaUserFindUniqueMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("child")).not.toBeNull();
  });

  it("/banned パスでは auth と BANチェックをスキップして children を表示する", async () => {
    headersMock.mockResolvedValue(makeHeaders("/banned"));
    getActiveMaintenanceWindowMock.mockResolvedValue(null);

    render(await RootLayout({ children: <div data-testid="child" /> }));

    expect(authMock).not.toHaveBeenCalled();
    expect(prismaUserFindUniqueMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("child")).not.toBeNull();
  });

  it("/api/ で始まるパスでは auth と BANチェックをスキップする", async () => {
    headersMock.mockResolvedValue(makeHeaders("/api/dashboard"));
    getActiveMaintenanceWindowMock.mockResolvedValue(null);

    render(await RootLayout({ children: <div data-testid="child" /> }));

    expect(authMock).not.toHaveBeenCalled();
    expect(prismaUserFindUniqueMock).not.toHaveBeenCalled();
  });

  it("prisma.user.findUnique を session.user.id で呼び出す", async () => {
    headersMock.mockResolvedValue(makeHeaders("/dashboard"));
    getActiveMaintenanceWindowMock.mockResolvedValue(null);
    authMock.mockResolvedValue({ user: { id: "user-42" } });
    prismaUserFindUniqueMock.mockResolvedValue({ isBanned: false });

    render(await RootLayout({ children: <div /> }));

    expect(prismaUserFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user-42" },
      select: { isBanned: true },
    });
  });
});

describe("RootLayout — children のレンダリング", () => {
  it("children がレイアウト内に表示される", async () => {
    headersMock.mockResolvedValue(makeHeaders("/"));
    getActiveMaintenanceWindowMock.mockResolvedValue(null);
    authMock.mockResolvedValue(null);

    render(await RootLayout({ children: <div data-testid="child">コンテンツ</div> }));

    expect(screen.getByTestId("child")).not.toBeNull();
    expect(screen.getByText("コンテンツ")).not.toBeNull();
  });
});
