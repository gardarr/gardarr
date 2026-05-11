import * as React from "react";

const PORTRAIT_MOBILE_TABLET_QUERY = "(max-width: 1023px) and (orientation: portrait)";

export function useIsPortraitMobileOrTablet() {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(PORTRAIT_MOBILE_TABLET_QUERY);
    const sync = () => setMatches(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);

    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return matches;
}
