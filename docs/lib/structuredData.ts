import { DEFAULT_DESCRIPTION, getHtmlLang, SITE_NAME, SITE_URL } from "./metadata";
import type { DocsLang } from "./i18n";

const localizedDescription = {
  en: DEFAULT_DESCRIPTION,
} as const;

const localizedFeatureList = {
  en: [
    "Manage 100+ SQL, NoSQL, vector, time-series, embedded databases, and message queues",
    "Desktop apps for Windows, macOS, and Linux",
    "Docker self-hosting for browser access",
    "AI-assisted SQL generation, explanation, optimization, and repair",
    "MCP Server integration for AI coding agents",
    "Schema browsing, schema diff, data editing, import, and export",
  ],
} as const;

export function buildSiteStructuredData() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: ["en"],
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      logo: `${SITE_URL}/logo.png`,
      sameAs: [
        "https://github.com/Gaussian-id/Chiron-DBMS",
      ],
    },
  ] as const;
}

export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildDocStructuredData(lang: DocsLang, title: string, description: string, path: string) {
  const url = `${SITE_URL}${path}`;
  const docsUrl = `${SITE_URL}/${lang}/docs/what-is-chiron-horizon`;
  const labels = ["Home", "Documentation"];

  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [{ "@type": "ListItem", position: 1, name: labels[0], item: `${SITE_URL}/${lang}` }, { "@type": "ListItem", position: 2, name: labels[1], item: docsUrl }, ...(url === docsUrl ? [] : [{ "@type": "ListItem", position: 3, name: title, item: url }])],
    },
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      "@id": `${url}#article`,
      url,
      mainEntityOfPage: url,
      headline: title,
      description,
      inLanguage: getHtmlLang(lang),
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#software` },
      author: { "@id": `${SITE_URL}/#organization` },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ];
}

export function buildSoftwareApplicationStructuredData(lang: DocsLang, version: string) {
  const language = getHtmlLang(lang);

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    url: `${SITE_URL}/${lang}`,
    description: localizedDescription.en,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "Database management",
    operatingSystem: "Windows, macOS, Linux, Docker",
    softwareVersion: version,
    isAccessibleForFree: true,
    inLanguage: language,
    codeRepository: "https://github.com/Gaussian-id/Chiron-DBMS",
    releaseNotes: `${SITE_URL}/${lang}/changelog`,
    license: "https://github.com/Gaussian-id/Chiron-DBMS/blob/main/LICENSE",
    screenshot: [`${SITE_URL}/screenshot-dark.png`, `${SITE_URL}/screenshot-er.png`, `${SITE_URL}/screenshot-grid.png`],
    featureList: [...localizedFeatureList.en],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    author: { "@id": `${SITE_URL}/#organization` },
    publisher: { "@id": `${SITE_URL}/#organization` },
    sameAs: ["https://github.com/Gaussian-id/Chiron-DBMS"],
  } as const;
}
