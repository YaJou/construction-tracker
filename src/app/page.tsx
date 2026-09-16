import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "СтройУчёт — учёт объектов, этапов, фото и расходов",
  description:
    "Ведите объекты строительства, этапы, фотоотчёты, бюджет и расходы в одном месте. СтройУчёт для прорабов, руководителей и заказчиков.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "СтройУчёт",
      url: "https://construction-tracker-blue.vercel.app",
      description:
        "Сервис учёта строительных объектов, этапов, фотоотчётов и расходов.",
    },
    {
      "@type": "SoftwareApplication",
      name: "СтройУчёт",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Учёт объектов строительства, этапов, фотоотчётов, бюджета и расходов.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "RUB",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
