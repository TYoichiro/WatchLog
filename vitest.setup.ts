// Prevent "Not implemented: navigation to another Document" warnings
// when anchor clicks with blob/data URLs are triggered (e.g. file downloads).
HTMLAnchorElement.prototype.click = function () {};

// jsdom does not implement scrollIntoView or scrollTo
Element.prototype.scrollIntoView = function () {};
Element.prototype.scrollTo = function () {};
