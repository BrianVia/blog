import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import image from "@astrojs/image";

// https://astro.build/config

// https://astro.build/config
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  integrations: [preact(), image(), tailwind()],
  site: `http://astro.build`
});