import { createFileRoute } from "@tanstack/react-router";
import ProductDetail from "@/pages/ProductDetail";

function toTitle(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const Route = createFileRoute("/product/$slug")({
  component: ProductDetail,
  head: ({ params }) => {
    const name = toTitle(params.slug);
    const title = `${name} | VedicUpchar Ayurveda`.slice(0, 60);
    const description = `Buy ${name} from VedicUpchar — authentic Ayurvedic formulations, doctor-approved, with fast delivery across India.`.slice(0, 158);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
});
