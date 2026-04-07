import type { Metadata } from "next";
import "./globals.css";
import { SessionInit } from "@/components/SessionInit";

export const metadata: Metadata = {
  title: "Cloudbox VAR Hunter",
  description: "Automated VAR prospecting pipeline for Cloudbox",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionInit />
        {children}
      </body>
    </html>
  );
}
