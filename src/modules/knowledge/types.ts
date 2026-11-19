export type NodeRecord = {
  id: string;
  title: string;
  topic: string;
  body: string;
  revision: number;
  project_id: string;
};
export type Evidence = {
  id: string;
  kind: string;
  source_id: string;
  session_id: string | null;
  title: string;
  body: string;
  origin: {
    kind?: string;
    origin?: string;
    references?: { url: string; title: string; kind: string }[];
    explicit_ref?: string;
  };
};
export type Change = {
  id: string;
  node_id: string;
  event_id: string;
  source_id: string;
  session_id: string | null;
  source_title: string;
  kind: string;
  origin: Evidence["origin"];
  quote: string;
  reason: string;
  previous: string;
  proposal: string;
  accepted: string | null;
  state: "review" | "applied" | "rejected";
  weight: number;
  created_at: string;
};
export type KnowledgeState = {
  nodes: NodeRecord[];
  changes: Change[];
  pending: number;
  failed: number;
};
