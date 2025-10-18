import path from "path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Set base based on the github static site (https://bendk.github.io/chessfiles/)
  base: "/chessfiles/",
  plugins: [solid(), tailwindcss()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
