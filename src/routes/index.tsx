import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      {
        title:
          "VedicUpchar - Authentic Ayurvedic Healthcare Products & Doctor Consultation",
      },
      {
        name: "description",
        content:
          "Shop 100% authentic Ayurvedic medicines, herbal products & get free doctor consultation. Trusted by 20 Lakh+ customers. Free delivery on orders above ₹699.",
      },
      {
        property: "og:title",
        content:
          "VedicUpchar - Authentic Ayurvedic Healthcare Products & Doctor Consultation",
      },
      {
        property: "og:description",
        content:
          "Shop 100% authentic Ayurvedic medicines, herbal products & get free doctor consultation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
