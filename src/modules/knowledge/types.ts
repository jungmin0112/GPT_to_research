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
  original_node?: string;
  decided_at: string | null;
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
  edits?: {
    id: string;
    node_id: string;
    previous: NodeRecord;
    updated: NodeRecord;
    created_at: string;
    new_node: string | null;
  }[];
  activity?: {
    id: string;
    title: string;
    state: string;
    attempts: number;
    created_at: string;
  }[];
  autoAttempts?: number;
  pending: number;
  failed: number;
};
