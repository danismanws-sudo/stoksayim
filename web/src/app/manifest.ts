import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Detay Stok Sayım",
    short_name: "Detay Sayım",
    description: "Kamera ile barkod okutarak fotoğraflı duran varlık sayımı.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0d13",
    theme_color: "#0a0d13",
    lang: "tr",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
