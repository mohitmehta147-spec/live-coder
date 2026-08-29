import { createFileRoute } from "@tanstack/react-router";
import AuthPage from "@/pages/AuthPage";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign In - VedicUpchar" },
      { name: "description", content: "Sign in or create your VedicUpchar account." },
      { property: "og:title", content: "Sign In - VedicUpchar" },
      { property: "og:description", content: "Sign in or create your VedicUpchar account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
