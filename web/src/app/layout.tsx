import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Detay Stok Sayım",
    template: "%s · Detay Stok Sayım",
  },
  description: "Kamera ile barkod okutarak hızlı ve fotoğraflı duran varlık sayımı.",
  applicationName: "Detay Stok Sayım",
  appleWebApp: { capable: true, title: "Detay Sayım", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.png", apple: "/icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0d13",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          richColors
          toastOptions={{ style: { fontFamily: "var(--font-manrope)" } }}
        />
      </body>
    </html>
  );
}
