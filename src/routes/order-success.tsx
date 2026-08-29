import { createFileRoute } from "@tanstack/react-router";
import OrderSuccessPage from "@/pages/OrderSuccessPage";

export const Route = createFileRoute("/order-success")({
  component: OrderSuccessPage,
  head: () => ({
    meta: [
      { title: "Order Successful - VedicUpchar" },
      { name: "description", content: "Your VedicUpchar order has been placed successfully." },
      { property: "og:title", content: "Order Successful - VedicUpchar" },
      { property: "og:description", content: "Your VedicUpchar order has been placed successfully." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
