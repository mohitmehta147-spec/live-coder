import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      {
        title: "VedicUpchar | Authentic Ayurvedic Healthcare",
      },
      {
        name: "description",
        content:
          "Authentic Ayurvedic medicines, herbal wellness products and free doctor consultation from VedicUpchar.",
      },
      {
        property: "og:title",
        content: "VedicUpchar | Authentic Ayurvedic Healthcare",
      },
      {
        property: "og:description",
        content:
          "Authentic Ayurvedic medicines, herbal wellness products and free doctor consultation.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://www.vedicupchar.com/logo.png?v=2" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://www.vedicupchar.com/logo.png?v=2" },
    ],
  }),
});
