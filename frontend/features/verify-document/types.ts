export type DocVerifyState = "AUTHENTIC" | "ALTERED" | "NOT_FOUND" | "UNREADABLE";

export interface DocVerifyDto {
  state: DocVerifyState;
  match: "FILE" | "CONTENT" | null;
  differing: string[];
}
