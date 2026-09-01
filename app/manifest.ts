import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SMJENA — hitne smjene bez čekanja",
    short_name: "SMJENA",
    description:
      "Najbrži način da poslodavci u Crnoj Gori popune hitnu smjenu, a provjereni radnici odmah zarade.",
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
