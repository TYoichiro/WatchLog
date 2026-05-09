import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppNotice } from "@/lib/dashboard-notices";
import { LoginScreen } from "./login-screen";

const googleLoginLabel = "Google\u3067\u30ed\u30b0\u30a4\u30f3";
const xLoginLabel = "X\u3067\u30ed\u30b0\u30a4\u30f3\uff08\u6e96\u5099\u4e2d\uff09";

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

    const xButton = screen.getByRole("button", { name: xLoginLabel });
    expect((xButton as HTMLButtonElement).disabled).toBe(true);
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
});
