export type SearchMode = "auto" | "off" | "required";
export type Citation = {
  url: string;
  title: string;
  kind: "citation" | "candidate";
  start?: number;
  end?: number;
};
export type Details = {
  explicit_ref_title?: string;
  related_records?: string[];
  explicit_ref?: string;
  webSearchUsed?: boolean;
  references?: Citation[];
  responseId?: string;
  usage?: unknown;
  model?: string;
  error?: string;
};
export type Turn = {
  id: string;
  question: string;
  search_mode: SearchMode;
  status: "working" | "failed" | "completed";
  answer: string;
  metadata: Details;
};
