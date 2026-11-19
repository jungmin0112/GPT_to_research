export type MaterialRow = {
  id: string;
  origin: string;
  kind: "url" | "pdf" | "text";
  title: string;
  state: "link" | "ready" | "failed";
  cited: boolean;
  candidate: boolean;
  manual: boolean;
};
export type Material = MaterialRow & {
  body: string;
  note: string;
  identity_key: string;
};
