import type { ReactNode } from "react";
export const metadata = { title: "Teleprompter" };
export default function Root({ children }: { children: ReactNode }) {
  return <html lang="en"><body style={{ margin: 0, fontFamily: "system-ui", background: "#0b0b0f", color: "#fff" }}>{children}</body></html>;
}
