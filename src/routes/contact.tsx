import { createFileRoute } from "@tanstack/react-router";
import ContactPage from "@/pages/ContactPage";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact Us - VedicUpchar" },
      { name: "description", content: "Get in touch with VedicUpchar support." },
      { property: "og:title", content: "Contact Us - VedicUpchar" },
      { property: "og:description", content: "Get in touch with VedicUpchar support." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
