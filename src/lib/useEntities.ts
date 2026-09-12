"use client";

import { useEffect, useState } from "react";

export interface EntityRow {
  id: string;
  name: string;
  icon: string | null;
  order: number;
}

export function useEntities() {
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/entities")
      .then((r) => r.json())
      .then(setEntities)
      .finally(() => setLoading(false));
  }, []);

  return { entities, loading };
}
