"use client";
import { useEffect, useState } from "react";
import { materialPath, readMaterial } from "./client";
import { request } from "@/shared/lib/request";
import type { Material } from "./types";
export function useCollection(
  project: string,
  revision: number,
  update: (doc: Material) => void,
) {
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function collect() {
      setError("");
      while (active) {
        const { id } = await request(materialPath(project) + "/collect", {});
        if (!active || !id) return;
        const doc = await readMaterial(project, id);
        if (active) update(doc);
      }
    }
    collect().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [project, revision, update]);
  return error;
}
