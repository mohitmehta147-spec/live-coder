import { createFileRoute } from "@tanstack/react-router";
import ReturnRequestPage from "@/pages/ReturnRequestPage";

export const Route = createFileRoute("/return-request")({
  component: ReturnRequestPage,
  head: () => ({
    meta: [
      { title: "Return Request - VedicUpchar" },
      { name: "description", content: "Request a return for your VedicUpchar order." },
      { property: "og:title", content: "Return Request - VedicUpchar" },
      { property: "og:description", content: "Request a return for your VedicUpchar order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
