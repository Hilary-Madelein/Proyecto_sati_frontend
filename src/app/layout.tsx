import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/Header";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SATI.EC · Sistema de alerta temprana de inundaciones para el Ecuador",
  description: "Monitoreo de lluvia, inundaciones fluviales, repentinas e históricas en Ecuador.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1d30",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex h-dvh flex-col overflow-hidden">
        <Header/>
        {children}
      </body>
    </html>
  );
}
