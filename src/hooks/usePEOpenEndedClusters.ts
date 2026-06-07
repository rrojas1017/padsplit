import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AIOpenEndedCluster {
  id: string;
  label: string;
  summary?: string;
  responseIndices: number[];
}

interface UsePEOpenEndedClustersParams {
  questionId: string;
  questionText: string;
  /** Trimmed, non-empty responses, in original order. */
  responses: string[];
  enabled?: boolean;
}

interface ClusterPayload {
  ok: true;
  source: "cache" | "ai";
  model: string;
  responseHash: string;
  clusters: AIOpenEndedCluster[];
}

const MIN_RESPONSES_FOR_AI = 8;

async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("crypto.subtle unavailable");
  const data = new TextEncoder().encode(text);
  const buf = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function useResponseHash(responses: string[]): string | null {
  const stable = useMemo(() => JSON.stringify(responses), [responses]);
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setHash(null);
    if (!stable || responses.length === 0) return;
    sha256Hex(stable)
      .then((h) => { if (!cancelled) setHash(h); })
      .catch(() => { if (!cancelled) setHash(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stable]);
  return hash;
}

export function usePEOpenEndedClusters({
  questionId,
  questionText,
  responses,
  enabled = true,
}: UsePEOpenEndedClustersParams) {
  const hash = useResponseHash(responses);
  const eligible =
    enabled &&
    !!questionId &&
    !!questionText &&
    responses.length >= MIN_RESPONSES_FOR_AI &&
    !!hash;

  return useQuery<ClusterPayload>({
    queryKey: ["pe-open-ended-clusters", questionId, hash],
    enabled: eligible,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "cluster-pe-open-ended",
        {
          body: {
            questionId,
            questionText,
            responses,
            responseHash: hash,
          },
        },
      );
      if (error) throw error;
      if (!data || data.ok !== true) {
        throw new Error(data?.reason || "ai_failed");
      }
      return data as ClusterPayload;
    },
  });
}
