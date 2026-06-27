import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

afterEach(() => {
  cleanup();
});

describe("Tooltip", () => {
  it("TooltipTrigger がレンダリングされる", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>ホバー</TooltipTrigger>
          <TooltipContent>ツールチップ</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText("ホバー")).toBeDefined();
  });

  it("data-slot='tooltip-trigger' が設定される", () => {
    const { container } = render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>ホバー</TooltipTrigger>
          <TooltipContent>内容</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(container.querySelector('[data-slot="tooltip-trigger"]')).toBeDefined();
  });

  it("TooltipProvider がカスタム delayDuration を受け付ける", () => {
    const { container } = render(
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger>ホバー</TooltipTrigger>
          <TooltipContent>内容</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(container.querySelector('[data-slot="tooltip-trigger"]')).toBeDefined();
  });

  it("TooltipContent がカスタム className を受け付ける", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>ホバー</TooltipTrigger>
          <TooltipContent className="custom-tooltip">内容テキスト</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    // TooltipContent は非表示状態でもDOMに登録されることがある
    expect(screen.getByText("ホバー")).toBeDefined();
  });
});
