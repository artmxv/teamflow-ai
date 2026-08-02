import { useRef, useState } from "react";

import { isBrowserOffline } from "@/lib/api-error";

type UseOnDemandFilePreparationResult = {
  isPreparing: boolean;
  isError: boolean;
  isOffline: boolean;
  /** True while a prepare/open request for this row is in flight. */
  isBusy: boolean;
  clearStatus: () => void;
  prepare: (action: () => Promise<void>) => Promise<void>;
};

/**
 * Per-row lazy file preparation: no network until prepare() is called
 * (typically from an explicit Open / Retry click).
 */
export function useOnDemandFilePreparation(): UseOnDemandFilePreparationResult {
  const [isPreparing, setIsPreparing] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const busyRef = useRef(false);

  function clearStatus() {
    setIsPreparing(false);
    setIsError(false);
    setIsOffline(false);
  }

  async function prepare(action: () => Promise<void>) {
    if (busyRef.current) {
      return;
    }

    if (isBrowserOffline()) {
      setIsPreparing(false);
      setIsError(true);
      setIsOffline(true);
      return;
    }

    busyRef.current = true;
    setIsPreparing(true);
    setIsError(false);
    setIsOffline(false);

    try {
      await action();
      setIsError(false);
      setIsOffline(false);
    } catch {
      setIsError(true);
      setIsOffline(isBrowserOffline());
    } finally {
      setIsPreparing(false);
      busyRef.current = false;
    }
  }

  return {
    isPreparing,
    isError,
    isOffline,
    isBusy: isPreparing,
    clearStatus,
    prepare,
  };
}
