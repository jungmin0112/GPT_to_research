import type { Database } from "@/server/database/database.types";
export type Project =
  Database["public"]["Functions"]["project_list"]["Returns"][number];
