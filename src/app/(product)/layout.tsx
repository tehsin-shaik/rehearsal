import type { ReactNode } from "react";
import { Shell } from "@/ui/shell/shell";
export default function ProductLayout({ children }: {
    children: ReactNode;
}) {
    return <Shell>{children}</Shell>;
}
