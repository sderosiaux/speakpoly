import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SpeakPoly - Learn Languages Through Real Conversations",
  description: "A safe, global platform for learning languages through real conversations with native speakers who want to learn your language in return.",
  keywords: "language exchange, language learning, native speakers, conversation practice, language partners",
  authors: [{ name: "SpeakPoly" }],
  openGraph: {
    title: "SpeakPoly - Learn Languages Through Real Conversations",
    description: "Connect with native speakers for authentic language exchange",
    type: "website",
    locale: "en_US",
    siteName: "SpeakPoly",
  },
  twitter: {
    card: "summary_large_image",
    title: "SpeakPoly - Learn Languages Through Real Conversations",
    description: "Connect with native speakers for authentic language exchange",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
