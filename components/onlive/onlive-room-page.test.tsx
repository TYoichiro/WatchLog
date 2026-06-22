import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RoomUserProfile, RoomUserRoomProfile } from "@/lib/showroom";
import { UserProfileModal } from "./onlive-room-page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const mockTarget = { userId: "user123", userName: "テストユーザー" };

const mockProfile: RoomUserProfile = {
  activeFanLevel: 10,
  avatarId: null,
  avatarUrl: null,
  classLevel: 5,
  description: "テストの説明文",
  fanLevel: 3,
  imageUrl: null,
  isSmsAuthenticated: true,
  name: "テストユーザー",
  snsList: [],
  roomProfile: null,
};

const mockRoomProfile: RoomUserRoomProfile = {
  avatarUrl: null,
  banners: [],
  currentLiveStartedAt: null,
  description: "ルームの説明",
  followerNum: 1000,
  genreName: "",
  imageSquareUrl: null,
  imageUrl: null,
  isOfficial: false,
  isOnlive: false,
  leagueLabel: "",
  mainName: "テストルーム",
  roomId: 12345,
  roomLevel: 50,
  roomName: "テストルーム",
  roomUrlKey: "testroom",
  shareTextLive: "",
  shareUrl: null,
  shareUrlLive: null,
  snsList: [],
  viewNum: null,
};

describe("UserProfileModal", () => {
  it("target=null のときダイアログが表示されない", () => {
    render(
      <UserProfileModal
        hasError={false}
        isLoading={false}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={null}
        target={null}
        view="user"
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("target があるときダイアログが表示される", () => {
    render(
      <UserProfileModal
        hasError={false}
        isLoading={false}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={null}
        target={mockTarget}
        view="user"
      />
    );
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("isLoading=true のときアニメーションスケルトンが表示される", () => {
    const { container } = render(
      <UserProfileModal
        hasError={false}
        isLoading={true}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={null}
        target={mockTarget}
        view="user"
      />
    );
    expect(container.querySelector(".animate-pulse")).toBeDefined();
  });

  it("hasError=true のときエラーメッセージが表示される", () => {
    render(
      <UserProfileModal
        hasError={true}
        isLoading={false}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={null}
        target={mockTarget}
        view="user"
      />
    );
    expect(
      screen.getByText("プロフィール情報の取得に失敗しました。")
    ).toBeDefined();
  });

  it("profile があるとき名前が表示される", () => {
    render(
      <UserProfileModal
        hasError={false}
        isLoading={false}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={mockProfile}
        target={mockTarget}
        view="user"
      />
    );
    expect(screen.getAllByText("テストユーザー").length).toBeGreaterThan(0);
  });

  it("profile の説明文が表示される", () => {
    render(
      <UserProfileModal
        hasError={false}
        isLoading={false}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={mockProfile}
        target={mockTarget}
        view="user"
      />
    );
    expect(screen.getByText("テストの説明文")).toBeDefined();
  });

  it("isSmsAuthenticated=true のとき「SMS認証済み」が表示される", () => {
    render(
      <UserProfileModal
        hasError={false}
        isLoading={false}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={mockProfile}
        target={mockTarget}
        view="user"
      />
    );
    expect(screen.getByText("SMS認証済み")).toBeDefined();
  });

  it("isSmsAuthenticated=false のとき「SMS未認証」が表示される", () => {
    const profile = { ...mockProfile, isSmsAuthenticated: false };
    render(
      <UserProfileModal
        hasError={false}
        isLoading={false}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={profile}
        target={mockTarget}
        view="user"
      />
    );
    expect(screen.getByText("SMS未認証")).toBeDefined();
  });

  it("ブロック済みユーザーのとき「ブロック済み」ボタンが disabled で表示される", () => {
    const blockedUserIds = new Set(["user123"]);
    render(
      <UserProfileModal
        blockedUserIds={blockedUserIds}
        hasError={false}
        isLoading={false}
        onBlockUser={vi.fn()}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={mockProfile}
        target={mockTarget}
        view="user"
      />
    );
    const blockButton = screen.getByRole("button", { name: /ブロック済み/ });
    expect(blockButton).toBeDefined();
    expect(blockButton.hasAttribute("disabled")).toBe(true);
  });

  it("「このユーザーをブロック」ボタンをクリックすると onBlockUser が呼ばれる", () => {
    const onBlockUser = vi.fn();
    render(
      <UserProfileModal
        hasError={false}
        isLoading={false}
        onBlockUser={onBlockUser}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={mockProfile}
        target={mockTarget}
        view="user"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /このユーザーをブロック/ }));
    expect(onBlockUser).toHaveBeenCalledWith(mockTarget, mockProfile);
  });

  it("「閉じる」ボタンをクリックすると onOpenChange(false) が呼ばれる", () => {
    const onOpenChange = vi.fn();
    render(
      <UserProfileModal
        hasError={false}
        isLoading={false}
        onOpenChange={onOpenChange}
        onViewChange={vi.fn()}
        profile={mockProfile}
        target={mockTarget}
        view="user"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("roomProfile があるとき「ユーザー」「ルーム」タブが表示される", () => {
    const profile = { ...mockProfile, roomProfile: mockRoomProfile };
    render(
      <UserProfileModal
        hasError={false}
        isLoading={false}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={profile}
        target={mockTarget}
        view="user"
      />
    );
    expect(screen.getByRole("button", { name: "ユーザー" })).toBeDefined();
    expect(screen.getByRole("button", { name: "ルーム" })).toBeDefined();
  });

  it("roomProfile がないとき「ユーザー」「ルーム」タブが表示されない", () => {
    render(
      <UserProfileModal
        hasError={false}
        isLoading={false}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={mockProfile}
        target={mockTarget}
        view="user"
      />
    );
    expect(screen.queryByRole("button", { name: "ユーザー" })).toBeNull();
    expect(screen.queryByRole("button", { name: "ルーム" })).toBeNull();
  });

  it("blockErrorMessage があるときエラーメッセージが表示される", () => {
    render(
      <UserProfileModal
        blockErrorMessage="ブロック登録に失敗しました"
        hasError={false}
        isLoading={false}
        onBlockUser={vi.fn()}
        onOpenChange={vi.fn()}
        onViewChange={vi.fn()}
        profile={mockProfile}
        target={mockTarget}
        view="user"
      />
    );
    expect(screen.getByText("ブロック登録に失敗しました")).toBeDefined();
  });
});
