import { createFileRoute } from "@tanstack/react-router";
import OrderTrackingPage from "@/pages/OrderTrackingPage";

export const Route = createFileRoute("/track-order")({
  component: OrderTrackingPage,
  head: () => ({
    meta: [
      { title: "Track Order - VedicUpchar" },
      { name: "description", content: "Track your VedicUpchar order status." },
      { property: "og:title", content: "Track Order - VedicUpchar" },
      { property: "og:description", content: "Track your VedicUpchar order status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
