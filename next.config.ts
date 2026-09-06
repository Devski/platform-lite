import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // #21: the deployment ships a container, and the image is built in CI
  // rather than on the instance it runs on (SPEC §3). `standalone` emits
  // `.next/standalone` with its own minimal server.js and only the traced
  // files, so the runtime layer needs no node_modules install and no build
  // toolchain.
  output: "standalone",
  // sharp carries platform-specific native binaries the tracer does not
  // always follow — the output reference names it as the common case. It is
  // the avatar pipeline's decoder, so a missing binary would surface as a
  // broken upload at runtime rather than a failed build. Pin it in.
  outputFileTracingIncludes: {
    // drizzle-orm's migrator is imported by deploy/migrate.mjs, which the
    // tracer never sees — nothing the pages render reaches it — so it would
    // be pruned out of the standalone tree and the deployment's migration
    // step would die on a missing module (#53).
    "/*": ["node_modules/sharp/**/*", "node_modules/drizzle-orm/**/*"],
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
