import type { ReactNode } from "react";
export function httpUrl(value: string) {
  if (!/^https?:\/\//i.test(value) || !URL.canParse(value)) return "";
  return value;
}

export function SourceLink({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}) {
  const url = httpUrl(href ?? "");
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}
