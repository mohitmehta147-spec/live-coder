import { createFileRoute } from "@tanstack/react-router";
import OrderHistoryPage from "@/pages/OrderHistoryPage";

export const Route = createFileRoute("/my-orders")({
  component: OrderHistoryPage,
  head: () => ({
    meta: [
      { title: "My Orders - VedicUpchar" },
      { name: "description", content: "View your VedicUpchar order history." },
      { property: "og:title", content: "My Orders - VedicUpchar" },
      { property: "og:description", content: "View your VedicUpchar order history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
