import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppNotice } from "@/lib/dashboard-notices";
import { LoginScreen } from "./login-screen";

const googleLoginLabel = "Google\u3067\u30ed\u30b0\u30a4\u30f3";

type FormAction = (formData: FormData) => void | Promise<void>;

type RenderLoginScreenOptions = {
  hasNoticesError?: boolean;
  loginNotices?: AppNotice[];
  signInWithGoogle?: FormAction;
};

function renderLoginScreen({
  hasNoticesError = false,
  loginNotices = [],
  signInWithGoogle = vi.fn(),
}: RenderLoginScreenOptions = {}) {
  render(
    <LoginScreen
      hasNoticesError={hasNoticesError}
      loginNotices={loginNotices}
      signInWithGoogle={signInWithGoogle}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("LoginScreen", () => {
  it("renders the available login actions", () => {
    renderLoginScreen();

    expect(screen.getByRole("heading", { level: 1, name: "WatchLog" })).toBeDefined();

    const googleButton = screen.getByRole("button", { name: googleLoginLabel });
    expect(googleButton.getAttribute("type")).toBe("submit");
    expect(googleButton.closest("form")).toBeDefined();
  });

  it("submits the Google sign-in action", async () => {
    const signInWithGoogle = vi.fn();

    renderLoginScreen({ signInWithGoogle });

    const googleButton = screen.getByRole("button", { name: googleLoginLabel });
    const form = googleButton.closest("form");

    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    });
    expect(signInWithGoogle.mock.calls[0][0]).toBeInstanceOf(FormData);
  });

  it("renders login notices with external links", () => {
    const notices: AppNotice[] = [
      {
        id: 1,
        title: "Maintenance notice",
        date: "2026/05/09 21:00",
        body: "Login will be briefly unavailable.",
        linkUrl: "https://example.com/maintenance",
      },
    ];

    renderLoginScreen({ loginNotices: notices });

    expect(screen.getByRole("heading", { level: 3, name: "1. Maintenance notice" })).toBeDefined();
    expect(screen.getByText("2026/05/09 21:00")).toBeDefined();
    expect(screen.getByText("Login will be briefly unavailable.")).toBeDefined();

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://example.com/maintenance");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("shows the error state instead of notices when notice loading fails", () => {
    renderLoginScreen({
      hasNoticesError: true,
      loginNotices: [
        {
          id: 1,
          title: "Hidden notice",
          date: "2026/05/09 21:00",
          body: "This notice should not be shown.",
          linkUrl: null,
        },
      ],
    });

    expect(screen.queryByText("Hidden notice")).toBeNull();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("shows the error message text in the error state", () => {
    renderLoginScreen({ hasNoticesError: true });

    expect(screen.getByText("お知らせを取得できませんでした")).toBeDefined();
    expect(screen.getByText("時間をおいて再読み込みしてください。")).toBeDefined();
  });

  it("renders the empty-notices state when no notices are available", () => {
    renderLoginScreen({ loginNotices: [] });

    expect(screen.getByText("公開中のお知らせはありません。")).toBeDefined();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("renders a notice without a link when linkUrl is null", () => {
    const notices: AppNotice[] = [
      {
        id: 1,
        title: "No link notice",
        date: "2026/05/09 21:00",
        body: "This notice has no external link.",
        linkUrl: null,
      },
    ];

    renderLoginScreen({ loginNotices: notices });

    expect(screen.getByText("This notice has no external link.")).toBeDefined();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
