import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets the window scroll position to the top on every route (pathname) change.
 * The app's main content scrolls on the window, so window.scrollTo is the correct target.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
