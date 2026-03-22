import clsx from "clsx";
import type { ReactNode } from "react";

type MobileDataListProps<T> = {
  items: T[];
  getKey: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => ReactNode;
  empty?: ReactNode;
  className?: string;
};

export function MobileDataList<T>({ items, getKey, renderItem, empty, className }: MobileDataListProps<T>) {
  if (!items.length) {
    return <div className={clsx("lg:hidden", className)}>{empty ?? null}</div>;
  }

  return (
    <div className={clsx("space-y-3 lg:hidden", className)}>
      {items.map((item, index) => (
        <div key={getKey(item, index)}>{renderItem(item, index)}</div>
      ))}
    </div>
  );
}