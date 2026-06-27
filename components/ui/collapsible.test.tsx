import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

afterEach(() => {
  cleanup();
});

describe("Collapsible", () => {
  it("data-slot='collapsible' でレンダリングされる", () => {
    const { container } = render(
      <Collapsible>
        <CollapsibleTrigger>開く</CollapsibleTrigger>
        <CollapsibleContent>コンテンツ</CollapsibleContent>
      </Collapsible>,
    );
    expect(container.querySelector('[data-slot="collapsible"]')).toBeDefined();
  });

  it("デフォルト状態ではコンテンツが非表示", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>開く</CollapsibleTrigger>
        <CollapsibleContent>コンテンツ</CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.queryByText("コンテンツ")).toBeNull();
  });

  it("トリガーをクリックするとコンテンツが表示される", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>開く</CollapsibleTrigger>
        <CollapsibleContent>コンテンツ</CollapsibleContent>
      </Collapsible>,
    );
    fireEvent.click(screen.getByText("開く"));
    expect(screen.getByText("コンテンツ")).toBeDefined();
  });

  it("defaultOpen=true でコンテンツが初期表示される", () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>閉じる</CollapsibleTrigger>
        <CollapsibleContent>コンテンツ</CollapsibleContent>
      </Collapsible>,
    );
    expect(screen.getByText("コンテンツ")).toBeDefined();
  });

  it("開いた状態でトリガーをクリックするとコンテンツが非表示になる", () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>閉じる</CollapsibleTrigger>
        <CollapsibleContent>コンテンツ</CollapsibleContent>
      </Collapsible>,
    );
    fireEvent.click(screen.getByText("閉じる"));
    expect(screen.queryByText("コンテンツ")).toBeNull();
  });

  it("CollapsibleTrigger が data-slot='collapsible-trigger' でレンダリングされる", () => {
    const { container } = render(
      <Collapsible>
        <CollapsibleTrigger>開く</CollapsibleTrigger>
      </Collapsible>,
    );
    expect(container.querySelector('[data-slot="collapsible-trigger"]')).toBeDefined();
  });
});
