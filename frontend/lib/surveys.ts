/** Survey types a citizen can pick (CS/SA/RS/BS). Labels live in `archive.surveys.*` (en + bn). */
export const SURVEYS = ["CS", "SA", "RS", "BS"] as const;
export type SurveyCode = (typeof SURVEYS)[number];
