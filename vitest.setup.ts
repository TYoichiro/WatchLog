// Prevent "Not implemented: navigation to another Document" warnings
// when anchor clicks with blob/data URLs are triggered (e.g. file downloads).
HTMLAnchorElement.prototype.click = function () {};

// jsdom does not implement scrollIntoView or scrollTo
Element.prototype.scrollIntoView = function () {};
Element.prototype.scrollTo = function () {};

// jsdom does not implement ResizeObserver (used by Radix UI primitives such as Switch)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
