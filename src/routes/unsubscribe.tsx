import { createFileRoute } from "@tanstack/react-router";
import UnsubscribePage from "@/pages/UnsubscribePage";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Unsubscribe - VedicUpchar" },
      { name: "description", content: "Unsubscribe from VedicUpchar emails." },
      { property: "og:title", content: "Unsubscribe - VedicUpchar" },
      { property: "og:description", content: "Unsubscribe from VedicUpchar emails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
