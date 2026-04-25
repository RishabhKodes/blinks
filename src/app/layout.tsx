import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Blinks",
  description: "AI-organized knowledge graph for saved resources",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // @ts-expect-error -- Next.js supports this prop for theme scripts
      suppressHydrationMismatch
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("blinks-theme");if(t!=="light"){document.documentElement.classList.add("dark")}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-page text-ink">{children}</body>
    </html>
  );
}
