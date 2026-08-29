import { createFileRoute } from "@tanstack/react-router";
import BlogDetailPage from "@/pages/BlogDetailPage";

function toTitle(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const Route = createFileRoute("/blog/$slug")({
  component: BlogDetailPage,
  head: ({ params }) => {
    const name = toTitle(params.slug);
    const title = `${name} | VedicUpchar Blog`.slice(0, 60);
    const description = `${name} — Ayurvedic health guidance, remedies and lifestyle tips from the VedicUpchar doctors.`.slice(0, 158);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
});
