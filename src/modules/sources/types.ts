export type MaterialRow = {
  id: string;
  kind: "url" | "pdf" | "text";
  title: string;
  state: "link" | "ready" | "failed";
  cited: boolean;
  candidate: boolean;
  manual: boolean;
};
export type Material = MaterialRow & {
  origin: string;
  body: string;
  note: string;
  identity_key: string;
};
