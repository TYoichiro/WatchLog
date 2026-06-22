import React from "react";

type LinkProps = {
  href: string;
  children?: React.ReactNode;
  className?: string;
  [key: string]: unknown;
};

export default function Link({ href, children, ...rest }: LinkProps) {
  return <a href={href} {...rest}>{children}</a>;
}
