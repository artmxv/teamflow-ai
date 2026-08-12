import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

function useViewportBelow(breakpoint: number) {
  const [matches, setMatches] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => {
      setMatches(window.innerWidth < breakpoint);
    };
    mql.addEventListener("change", onChange);
    setMatches(window.innerWidth < breakpoint);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return !!matches;
}

export function useIsMobile() {
  return useViewportBelow(MOBILE_BREAKPOINT);
}

export function useIsCompactViewport() {
  return useViewportBelow(DESKTOP_BREAKPOINT);
}
