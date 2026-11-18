import { useEffect } from "react";

// Load the existing MIT-licensed toolbar after hydration. Its DOM belongs to the
// library, outside React's page content, so it survives client-side navigation.
export function AccessibilityWidget() {
  useEffect(() => {
    let mounted = true;
    let dispose: (() => void) | undefined;
    import("../client/accessibility.client").then(({ mountAccessibility }) => {
      if (mounted) dispose = mountAccessibility();
    }).catch(() => { console.warn("Accessibility toolbar could not load; the accessibility statement remains available."); });
    return () => { mounted = false; dispose?.(); };
  }, []);
  return <a className="accessibility-fallback" href="/accessibility/" aria-label="מידע ועזרה בנושא נגישות">נגישות</a>;
}
