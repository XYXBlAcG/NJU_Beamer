import { useEffect, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { gridColumns } from "../domain/cache";

export function VirtualGrid<Item>({ items, minWidth, rowHeight, gap = 8, render, itemKey, className = "", activeIndex }: {
  items: Item[]; minWidth: number; rowHeight: number; gap?: number; render: (item: Item, index: number) => ReactNode; itemKey: (item: Item) => string | number; className?: string; activeIndex?: number;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    if (scroll.current) observer.observe(scroll.current);
    return () => observer.disconnect();
  }, []);
  const columns = gridColumns(width, minWidth, gap);
  const rows = useVirtualizer({ count: Math.ceil(items.length / columns), getScrollElement: () => scroll.current, estimateSize: () => rowHeight + gap, overscan: 2 });
  const scrollToIndex = rows.scrollToIndex;
  useEffect(() => { rows.measure(); }, [rows, rowHeight, columns]);
  useEffect(() => {
    if (activeIndex !== undefined) scrollToIndex(Math.floor(activeIndex / columns), { align: "auto" });
  }, [activeIndex, columns, scrollToIndex]);
  return <div ref={scroll} className={`virtual-grid ${className}`}>
    <div style={{ height: rows.getTotalSize(), position: "relative" }}>
      {rows.getVirtualItems().map((row) => <div key={row.key} className="virtual-grid-row" style={{ position: "absolute", top: 0, width: "100%", transform: `translateY(${row.start}px)`, display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap, height: rowHeight }}>
        {items.slice(row.index * columns, (row.index + 1) * columns).map((item, offset) => <div key={itemKey(item)} className="virtual-grid-cell">{render(item, row.index * columns + offset)}</div>)}
      </div>)}
    </div>
  </div>;
}
