import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { GlobalError } from "@/components/GlobalError";

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
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <QueryProvider>
          <GlobalError />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
