// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro,
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Lovable resolves preset as: userNitroOpts.preset ?? process.env.NITRO_PRESET ?? "cloudflare-module".
// Keep an explicit default so local/Render builds stay on node-server (not cloudflare-module).
const nitroPreset = process.env.NITRO_PRESET ?? "node-server";

// Lovable always injects output { dir/serverDir/publicDir: dist* }. For the vercel preset that
// would break Build Output API, so restore Nitro's own vercel output templates only in that case.
const nitroVercelOutput =
  nitroPreset === "vercel"
    ? {
        dir: ".vercel/output",
        serverDir: "{{ output.dir }}/functions/__server.func",
        publicDir: "{{ output.dir }}/static/{{ baseURL }}",
      }
    : undefined;

export default defineConfig({
  nitro: {
    preset: nitroPreset,
    ...(nitroVercelOutput ? { output: nitroVercelOutput } : {}),
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
