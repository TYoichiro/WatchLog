import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, it } from "vitest";

import BannedPage from "./page";

afterEach(() => {
  cleanup();
});

describe("BannedPage", () => {
  it("エラーなくレンダリングされる", () => {
    render(<BannedPage />);
  });
});
