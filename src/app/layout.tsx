import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { STORE_NAME } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${STORE_NAME} — Wholesale B2B Marketplace`, template: `%s | ${STORE_NAME}` },
  description: "Order wholesale stock for your shop at the best bulk prices with fast, live-tracked delivery.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b5cf5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("wb_theme")!=="light")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
        <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>{children}</CartProvider>
          </AuthProvider>
        </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
