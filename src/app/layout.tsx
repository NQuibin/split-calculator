import type { Metadata, Viewport } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Sidebar } from "@/components/Sidebar";
import { TitleStabilizer } from "@/components/TitleStabilizer";
import { BASE_PATH } from "@/lib/basePath";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Split Calculator — split the expense",
  description: "Itemize any expense — restaurant, grocery, or service — and split it fairly.",
  icons: {
    icon: `${BASE_PATH}/icon.svg`,
    apple: `${BASE_PATH}/apple-icon`,
  },
  appleWebApp: {
    title: "Split Calculator",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f4a3c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TitleStabilizer />
        <ConvexClientProvider>
          <div className="flex min-h-full flex-col md:flex-row">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              {children}
              <Footer />
            </div>
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
