import { createFileRoute } from "@tanstack/react-router";
import ProductsPage from "@/pages/ProductsPage";

export const Route = createFileRoute("/products")({
  component: ProductsPage,
  head: () => ({
    meta: [
      { title: "Products - VedicUpchar" },
      {
        name: "description",
        content:
          "Browse authentic Ayurvedic medicines, herbal juices, oils, and wellness products.",
      },
      { property: "og:title", content: "Products - VedicUpchar" },
      {
        property: "og:description",
        content:
          "Browse authentic Ayurvedic medicines, herbal juices, oils, and wellness products.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
