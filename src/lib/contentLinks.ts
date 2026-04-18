// Content link mappings - stored in Supabase Storage
// Files are served via CDN public URLs

export const CONTENT_BASE_URL = "https://fildaxejimuvfrcqmoba.supabase.co/storage/v1/object/public";

export const contentLinks = {
  // "5-HT2A receptor" → brain routing effects image
  ht2aReceptor: `${CONTENT_BASE_URL}/content-images/brain-routing-effects.jpg`,

  // "Blocks TNF-α, IL-1β, and IL-6 cytokines through 5-HT2A activation" → Mushrooms Microdosing PDF
  antiInflammatoryCytokines: `${CONTENT_BASE_URL}/content-documents/mushrooms-microdosing.pdf`,

  // "providing significant anti-inflammatory pathways" → brain routing effects image
  antiInflammatoryPathways: `${CONTENT_BASE_URL}/content-images/brain-routing-effects.jpg`,

  // "Enhances BDNF (Brain-Derived Neurotrophic Factor) stimulation..." → Psilocybin microdosers PDF
  bdnfNeuroplasticity: `${CONTENT_BASE_URL}/content-documents/psilocybin-microdosers.pdf`,
} as const;

export type ContentLinkKey = keyof typeof contentLinks;
