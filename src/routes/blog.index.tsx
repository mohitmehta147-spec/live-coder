import { createFileRoute } from "@tanstack/react-router";
import BlogsPage from "@/pages/BlogsPage";

export const Route = createFileRoute("/blog/")({
  component: BlogsPage,
  head: () => ({
    meta: [
      { title: "Ayurvedic Health Blog - VedicUpchar" },
      { name: "description", content: "Read expert Ayurvedic health tips, natural remedies, herbal medicine guides and wellness articles." },
      { property: "og:title", content: "Ayurvedic Health Blog - VedicUpchar" },
      { property: "og:description", content: "Read expert Ayurvedic health tips, natural remedies, herbal medicine guides and wellness articles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});