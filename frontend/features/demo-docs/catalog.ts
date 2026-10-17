/** Synthetic demo files served from /public/demo-docs (byte-identical copies of database/sample_data,
 *  so the backend's demo fixtures recognise them by hash). `name` is the neutral file name the form
 *  receives, as if picked from the user's own device; the hash, not the name, identifies the sample. */
export interface DemoDoc {
  key: string;
  /** File under /public/demo-docs. */
  file: string;
  /** Name shown in the picker and given to the attached File. */
  name: string;
}

/** Synthetic owners from database/seed/data.json (NID + date of birth), the parties named on the sample deeds. */
export const DEMO_OWNERS = {
  rahim: { nid: "19759990000000001", dob: "1975-03-12" },
  karim: { nid: "19809990000000002", dob: "1980-07-01" },
  hasan: { nid: "19689990000000003", dob: "1968-11-23" },
  jamal: { nid: "19909990000000004", dob: "1990-01-30" },
} as const;
export type DemoOwner = keyof typeof DEMO_OWNERS;

export interface UploadDemoDoc extends DemoDoc {
  /** Khatian/porcha go through the survey-record parser, so the form's type follows the file. */
  docType: "DEED" | "KHATIAN" | "PORCHA";
  /** Deeds: who sells and who buys, so picking the sample also fills the parties' NIDs. */
  parties?: { seller: DemoOwner; buyer: DemoOwner };
}

export const DEMO_DOC_DIR = "/demo-docs";

export const UPLOAD_DEMO_DOCS: UploadDemoDoc[] = [
  { key: "doc1", file: "Doc1.png", name: "Sale_Deed_01.png", docType: "DEED", parties: { seller: "rahim", buyer: "karim" } },
  { key: "doc2", file: "Doc2.png", name: "Sale_Deed_02.png", docType: "DEED", parties: { seller: "rahim", buyer: "hasan" } },
  { key: "areaMismatch", file: "AreaMismatch.png", name: "Sale_Deed_03.png", docType: "DEED", parties: { seller: "jamal", buyer: "karim" } },
  { key: "sellerMismatch", file: "SellerMismatch.png", name: "Sale_Deed_04.png", docType: "DEED", parties: { seller: "rahim", buyer: "hasan" } },
  { key: "clean", file: "Clean.png", name: "Sale_Deed_05.png", docType: "DEED", parties: { seller: "jamal", buyer: "hasan" } },
  { key: "khatian", file: "Khatian_RS.png", name: "Khatian_RS.png", docType: "KHATIAN" },
  { key: "porcha", file: "Porcha_BS.png", name: "Porcha_BS.png", docType: "PORCHA" },
];

/** Verify a copy: copies of seeded deed D-2021-0240 (as recorded / area edited / blurred) and an unrecorded deed. */
export const VERIFY_DEMO_DOCS: DemoDoc[] = [
  { key: "altered", file: "Verify_Altered.png", name: "Deed_Copy_01.png" },
  { key: "authentic", file: "Verify_Authentic.png", name: "Deed_Copy_02.png" },
  { key: "unreadable", file: "Verify_Unreadable.png", name: "Deed_Copy_03.png" },
  { key: "notFound", file: "Clean.png", name: "Deed_Copy_04.png" },
];

export async function fetchDemoFile(doc: DemoDoc): Promise<File> {
  const res = await fetch(`${DEMO_DOC_DIR}/${doc.file}`);
  if (!res.ok) throw new Error(`demo file ${doc.file}: ${res.status}`);
  const blob = await res.blob();
  return new File([blob], doc.name, { type: blob.type || "image/png" });
}
