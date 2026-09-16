import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Layout } from "@/components/layout/Layout";
import { AuthProvider } from "@/components/auth/AuthProvider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "СтройУчёт — учёт объектов, этапов, фото и расходов",
  description:
    "Ведите объекты строительства, этапы, фотоотчёты, бюджет и расходы в одном месте. СтройУчёт для прорабов, руководителей и заказчиков.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} font-sans`}>
        <AuthProvider>
          <Layout>{children}</Layout>
        </AuthProvider>
      </body>
    </html>
  );
}
