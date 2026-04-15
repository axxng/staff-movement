import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Staff Movement",
  description: "Track org reporting lines and staff movement across squads",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
