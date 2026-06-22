import { useEffect, useState } from "react";
import type { TKey } from "@/lib/i18n";

const STARTING_DELAY_MS = 2_000;
const PREPARING_DELAY_MS = 5_000;

type LoadingPhase = "initial" | "starting" | "preparing";

/**
 * After a short wait, surfaces friendly copy while the backend wakes up.
 */
export function useSlowLoadingMessage(active = true): TKey | null {
  const [phase, setPhase] = useState<LoadingPhase>("initial");

  useEffect(() => {
    if (!active) {
      setPhase("initial");
      return;
    }

    setPhase("initial");
    const startingTimer = window.setTimeout(() => setPhase("starting"), STARTING_DELAY_MS);
    const preparingTimer = window.setTimeout(() => setPhase("preparing"), PREPARING_DELAY_MS);

    return () => {
      window.clearTimeout(startingTimer);
      window.clearTimeout(preparingTimer);
    };
  }, [active]);

  if (!active || phase === "initial") {
    return null;
  }
  if (phase === "starting") {
    return "loading.startingWorkspace";
  }
  return "loading.preparingWorkspace";
}
