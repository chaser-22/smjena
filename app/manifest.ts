import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SMJENA — hitne smjene bez čekanja",
    short_name: "SMJENA",
    description:
      "Hitne ugostiteljske smjene u Crnoj Gori, sa jasnim uslovima i stvarnim statusom popunjavanja.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1eb",
    theme_color: "#101d34",
    lang: "sr-Latn-ME",
    categories: ["business", "productivity", "lifestyle"],
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
