"use client";

// One row inside a <FreshRows> list. Renders the same markup the page would
// have written by hand; the only addition is the wash while the record is new.
import type { ReactNode } from "react";
import { useFreshId } from "./FreshRows";

export function FreshRow({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const fresh = useFreshId(id);

  return <div className={`${className ?? ""} ${fresh ? "row-fresh" : ""}`.trim()}>{children}</div>;
}
