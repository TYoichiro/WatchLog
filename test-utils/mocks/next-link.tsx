import React from "react";
import type { ComponentProps } from "react";
import type NextLink from "next/link";

export default function Link({
  href,
  children,
  onClick,
  onNavigate,
  replace: _replace,
  scroll: _scroll,
  prefetch: _prefetch,
  transitionTypes: _transitionTypes,
  ...rest
}: ComponentProps<typeof NextLink>) {
  return (
    <a
      href={String(href)}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented || event.button !== 0 || event.metaKey ||
          event.ctrlKey || event.shiftKey || event.altKey ||
          (rest.target && rest.target !== "_self") || rest.download !== undefined
        ) return;
        if (new URL(String(href), window.location.href).origin !== window.location.origin) return;
        onNavigate?.({ preventDefault: () => event.preventDefault() });
      }}
    >
      {children}
    </a>
  );
}
