import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DayStack",
    short_name: "DayStack",
    description: "A calmer way to plan your day, follow through, and keep the score honest.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F8FC",
    theme_color: "#1496E8",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
