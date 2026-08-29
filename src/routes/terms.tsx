import { createFileRoute } from "@tanstack/react-router";
import TermsPage from "@/pages/TermsPage";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions - VedicUpchar" },
      { name: "description", content: "VedicUpchar terms and conditions." },
      { property: "og:title", content: "Terms & Conditions - VedicUpchar" },
      { property: "og:description", content: "VedicUpchar terms and conditions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
