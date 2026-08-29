import { createFileRoute } from "@tanstack/react-router";
import AdminPage from "@/pages/AdminPage";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin - VedicUpchar" },
      { name: "description", content: "VedicUpchar admin dashboard." },
      { property: "og:title", content: "Admin - VedicUpchar" },
      { property: "og:description", content: "VedicUpchar admin dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
