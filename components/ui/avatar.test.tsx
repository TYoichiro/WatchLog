import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "./avatar";

afterEach(() => {
  cleanup();
});

describe("Avatar", () => {
  it("data-slot='avatar' でレンダリングされる", () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(container.querySelector('[data-slot="avatar"]')).toBeDefined();
  });

  it("デフォルト size='default' が data-size に反映される", () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(container.querySelector('[data-slot="avatar"]')?.getAttribute("data-size")).toBe("default");
  });

  it("size='sm' が data-size='sm' に反映される", () => {
    const { container } = render(
      <Avatar size="sm">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(container.querySelector('[data-slot="avatar"]')?.getAttribute("data-size")).toBe("sm");
  });

  it("size='lg' が data-size='lg' に反映される", () => {
    const { container } = render(
      <Avatar size="lg">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(container.querySelector('[data-slot="avatar"]')?.getAttribute("data-size")).toBe("lg");
  });

  it("AvatarFallback がフォールバックテキストを表示する", () => {
    render(
      <Avatar>
        <AvatarFallback>山田</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("山田")).toBeDefined();
  });

  it("AvatarImage が data-slot='avatar-image' でレンダリングされる", () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="/avatar.png" alt="ユーザー" />
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(container.querySelector('[data-slot="avatar-image"]')).toBeDefined();
  });

  it("AvatarBadge が data-slot='avatar-badge' でレンダリングされる", () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
        <AvatarBadge />
      </Avatar>,
    );
    expect(container.querySelector('[data-slot="avatar-badge"]')).toBeDefined();
  });

  it("AvatarGroup が data-slot='avatar-group' でレンダリングされる", () => {
    const { container } = render(
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>B</AvatarFallback>
        </Avatar>
      </AvatarGroup>,
    );
    expect(container.querySelector('[data-slot="avatar-group"]')).toBeDefined();
    expect(screen.getByText("A")).toBeDefined();
    expect(screen.getByText("B")).toBeDefined();
  });

  it("AvatarGroupCount がカウントを表示する", () => {
    render(
      <AvatarGroup>
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>,
    );
    expect(screen.getByText("+3")).toBeDefined();
  });
});
