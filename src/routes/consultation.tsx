import { createFileRoute } from "@tanstack/react-router";
import ConsultationPage from "@/pages/ConsultationPage";

export const Route = createFileRoute("/consultation")({
  component: ConsultationPage,
  head: () => ({
    meta: [
      { title: "Free Consultation - VedicUpchar" },
      {
        name: "description",
        content:
          "Book a free consultation with certified Ayurvedic doctors.",
      },
      { property: "og:title", content: "Free Consultation - VedicUpchar" },
      {
        property: "og:description",
        content:
          "Book a free consultation with certified Ayurvedic doctors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
