import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Juicy Meets - Video Chat Platform",
  description:
    "Connect with people worldwide through video chat and build meaningful relationships across cultures and borders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
