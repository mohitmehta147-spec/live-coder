import { createFileRoute } from "@tanstack/react-router";
import CheckoutPage from "@/pages/CheckoutPage";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({
    meta: [
      { title: "Checkout - VedicUpchar" },
      { name: "description", content: "Complete your Ayurvedic wellness order." },
      { property: "og:title", content: "Checkout - VedicUpchar" },
      { property: "og:description", content: "Complete your Ayurvedic wellness order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
