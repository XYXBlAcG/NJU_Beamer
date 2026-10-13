import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";

export function Inspector({ children }: { children: ReactNode }) {
  return <aside className="inspector"><div className="inspector-title"><Settings2 size={17} />属性</div>{children}</aside>;
}
