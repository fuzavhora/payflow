import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "PayFlow — Payments workspace", description: "A developer-first payments and billing platform." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
