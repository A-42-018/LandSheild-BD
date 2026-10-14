/** Static information pages (E2): slug -> section ids under messages `info.<ns>`. `list` = the section also has an `items` array. */
export interface InfoSection {
  id: string;
  list?: boolean;
}

export const INFO_PAGES = {
  accessibility: { ns: "accessibility", sections: [{ id: "s1", list: true }, { id: "s2", list: true }, { id: "s3" }] },
  privacy: { ns: "privacy", sections: [{ id: "s1", list: true }, { id: "s2", list: true }, { id: "s3" }, { id: "s4" }] },
  terms: { ns: "terms", sections: [{ id: "s1" }, { id: "s2", list: true }, { id: "s3" }, { id: "s4" }] },
  "data-sources": { ns: "dataSources", sections: [{ id: "s1" }, { id: "s2", list: true }, { id: "s3" }, { id: "s4", list: true }] },
} as const satisfies Record<string, { ns: string; sections: readonly InfoSection[] }>;

export type InfoSlug = keyof typeof INFO_PAGES;

export const FAQ_IDS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"] as const;

export const SITEMAP_GROUPS = [
  { id: "services", links: [["/services", "services.title"], ["/verify", "nav.verify"], ["/check", "nav.check"], ["/track", "nav.track"], ["/verify-document", "nav.verifyDoc"], ["/map", "nav.map"]] },
  { id: "tools", links: [["/tools", "tools.title"], ["/tools/units", "info.sitemap.units"], ["/tools/fees", "info.sitemap.fees"], ["/tools/inheritance", "info.sitemap.inheritance"]] },
  { id: "information", links: [["/about", "nav.about"], ["/faq", "info.faq.title"], ["/feedback", "feedback.title"], ["/accessibility", "info.accessibility.title"], ["/privacy", "info.privacy.title"], ["/terms", "info.terms.title"], ["/data-sources", "info.dataSources.title"], ["/sitemap", "info.sitemap.title"]] },
  { id: "account", links: [["/login", "nav.login"], ["/officer-signup", "info.sitemap.signup"]] },
] as const;
