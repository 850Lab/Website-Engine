/**
 * @deprecated Use `prepare-assets` or `src/assets/asset-pipeline.js`.
 * Kept for backward compatibility with `generate-ai-assets`.
 */
import { prepareAssetsForLead } from "./assets/asset-pipeline.js";

export { AI_ASSET_FILES } from "./assets/ai-assets.js";

export async function generateAiAssetsForLead(lead) {
  const result = await prepareAssetsForLead(lead);
  return {
    previewDir: result.previewDir,
    slug: result.slug,
    assetsDir: result.previewDir,
    files: {
      hero: result.manifest.hero,
      trust: result.manifest.support,
      cta: result.manifest.cta,
    },
  };
}
