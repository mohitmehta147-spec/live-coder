import { createFileRoute } from "@tanstack/react-router";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy - VedicUpchar" },
      { name: "description", content: "VedicUpchar privacy policy." },
      { property: "og:title", content: "Privacy Policy - VedicUpchar" },
      { property: "og:description", content: "VedicUpchar privacy policy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
