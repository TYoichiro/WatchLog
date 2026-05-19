import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Prevent "Not implemented: navigation to another Document" warnings
// when anchor clicks with blob/data URLs are triggered (e.g. file downloads).
HTMLAnchorElement.prototype.click = function () {};

afterEach(() => {
  cleanup();
});
