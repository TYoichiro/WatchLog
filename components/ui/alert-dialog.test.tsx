import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";

afterEach(() => {
  cleanup();
});

describe("AlertDialog", () => {
  it("トリガーをクリックするとダイアログが表示される", () => {
    render(
      <AlertDialog>
        <AlertDialogTrigger>開く</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>確認</AlertDialogTitle>
          <AlertDialogDescription>本当に削除しますか？</AlertDialogDescription>
          <AlertDialogAction>削除</AlertDialogAction>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>,
    );
    fireEvent.click(screen.getByText("開く"));
    expect(screen.getByText("確認")).toBeDefined();
    expect(screen.getByText("本当に削除しますか？")).toBeDefined();
  });

  it("defaultOpen=true で初期からダイアログが表示される", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>確認</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(screen.getByText("確認")).toBeDefined();
  });

  it("AlertDialogAction がボタンとして描画される", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>確認</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogAction>確定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(screen.getByRole("button", { name: "確定" })).toBeDefined();
  });

  it("AlertDialogCancel がボタンとして描画される", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>確認</AlertDialogTitle>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDefined();
  });

  it("AlertDialogHeader が data-slot='alert-dialog-header' でレンダリングされる", () => {
    const { container } = render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>タイトル</AlertDialogTitle>
          <AlertDialogHeader>ヘッダー</AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(container.querySelector('[data-slot="alert-dialog-header"]')).toBeDefined();
  });

  it("AlertDialogMedia が data-slot='alert-dialog-media' でレンダリングされる", () => {
    const { container } = render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>タイトル</AlertDialogTitle>
          <AlertDialogMedia>アイコン</AlertDialogMedia>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(container.querySelector('[data-slot="alert-dialog-media"]')).toBeDefined();
  });

  it("size='sm' が data-size='sm' に反映される", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent size="sm">
          <AlertDialogTitle>タイトル</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(
      document.body.querySelector('[data-slot="alert-dialog-content"]')?.getAttribute("data-size"),
    ).toBe("sm");
  });

  it("size='full' が data-size='full' に反映される", () => {
    render(
      <AlertDialog defaultOpen>
        <AlertDialogContent size="full">
          <AlertDialogTitle>タイトル</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(
      document.body.querySelector('[data-slot="alert-dialog-content"]')?.getAttribute("data-size"),
    ).toBe("full");
  });
});
