"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

import { useNavigation } from "@/components/navigation/navigation-progress";

type NavigationLinkProps = Omit<ComponentProps<typeof NextLink>, "href" | "as" | "legacyBehavior"> & {
  href: string;
};

export function NavigationLink({
  href,
  replace,
  scroll,
  transitionTypes,
  onNavigate,
  ...props
}: NavigationLinkProps) {
  const navigation = useNavigation();

  return (
    <NextLink
      {...props}
      href={href}
      replace={replace}
      scroll={scroll}
      transitionTypes={transitionTypes}
      onNavigate={(event) => {
        let prevented = false;
        onNavigate?.({
          preventDefault() {
            prevented = true;
            event.preventDefault();
          },
        });
        if (prevented || !navigation) return;

        // Next only calls onNavigate for same-tab client navigation. Keeping
        // the transition in the layout also covers links in closing menus.
        event.preventDefault();
        navigation.navigate(href, { replace, scroll, transitionTypes });
      }}
    />
  );
}
