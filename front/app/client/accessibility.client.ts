import { Accessibility } from "accessibility";

export function mountAccessibility() {
  if (document.querySelector("._access-icon")) return () => {};
  let persistent = false;
  try {
    localStorage.setItem("_roniella_access_test", "1");
    localStorage.removeItem("_roniella_access_test");
    const saved = localStorage.getItem("_accessState");
    if (saved) {
      try { JSON.parse(saved); } catch { localStorage.removeItem("_accessState"); }
    }
    persistent = true;
  } catch { /* The upstream library supports sessions without local storage. */ }
  const widget = new Accessibility({
    icon: {
      useEmojis: true, // No Google Fonts request; icon glyphs are decorative.
      imgElem: { type: "span", attrs: { "aria-hidden": "true" }, children: [{ type: "#text", text: "♿" }] },
      closeIconElem: { type: "span", attrs: { "aria-hidden": "true" }, children: [{ type: "#text", text: "×" }] },
      resetIconElem: { type: "span", attrs: { "aria-hidden": "true" }, children: [{ type: "#text", text: "↺" }] },
    },
    session: { persistent },
    textSizeFactor: 25,
    labels: {
      menuTitle: "תפריט נגישות", closeTitle: "סגירת תפריט נגישות", resetTitle: "איפוס הגדרות הנגישות",
      increaseText: "הגדלת טקסט", decreaseText: "הקטנת טקסט",
      increaseTextSpacing: "הגדלת ריווח טקסט", decreaseTextSpacing: "הקטנת ריווח טקסט",
      increaseLineHeight: "הגדלת ריווח שורות", decreaseLineHeight: "הקטנת ריווח שורות",
      invertColors: "היפוך צבעים", grayHues: "גווני אפור", underlineLinks: "הדגשת קישורים",
      bigCursor: "סמן מוגדל", readingGuide: "מדריך קריאה", disableAnimations: "עצירת אנימציות",
      textToSpeech: "הקראת טקסט", speechToText: "הכתבה", hotkeyPrefix: "קיצור מקלדת: ",
    },
    // Speech recognition/synthesis depend on browser permissions and installed
    // Hebrew voices. Keep the stable visual tools, without requesting a microphone.
    modules: {
      increaseText: true, decreaseText: true, increaseTextSpacing: true, decreaseTextSpacing: true,
      increaseLineHeight: true, decreaseLineHeight: true, invertColors: true, grayHues: true,
      underlineLinks: true, bigCursor: true, readingGuide: true, disableAnimations: true,
      textToSpeech: false, speechToText: false,
    },
    customFunctions: [
      { id: "statement", buttonText: "הצהרת נגישות", emoji: "ⓘ", toggle: false, method: () => window.location.assign("/accessibility/") },
      { id: "feedback", buttonText: "דיווח על בעיית נגישות", emoji: "✉", toggle: false, method: () => window.location.assign("/accessibility/#accessibility-feedback") },
    ],
  });

  // Integration fixes for the published toolbar: keep the closed panel out of
  // the tab order, label its launcher, and support Space/Escape and focus return.
  // All display transformations and their UI remain the upstream implementation.
  const icon = document.querySelector<HTMLElement>("._access-icon")!;
  const menu = document.querySelector<HTMLElement>("._access-menu")!;
  icon.setAttribute("role", "button");
  icon.setAttribute("aria-label", "פתיחת תפריט נגישות");
  icon.setAttribute("aria-haspopup", "dialog");
  menu.id = "accessibility-options";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-label", "תפריט נגישות");
  menu.querySelector("._menu-close-btn")?.setAttribute("aria-label", "סגירת תפריט נגישות");
  menu.querySelector("._menu-reset-btn")?.setAttribute("aria-label", "איפוס הגדרות הנגישות");
  for (const button of menu.querySelectorAll<HTMLButtonElement>("button[data-access-action]")) {
    button.type = "button";
    button.setAttribute("aria-label", button.textContent?.trim() ?? "");
  }
  let wasOpen = false;
  const synchronize = () => {
    const open = !menu.classList.contains("close");
    menu.inert = !open;
    menu.setAttribute("aria-hidden", String(!open));
    icon.setAttribute("aria-expanded", String(open));
    if (open) icon.setAttribute("aria-controls", menu.id);
    else icon.removeAttribute("aria-controls");
    for (const button of menu.querySelectorAll<HTMLButtonElement>("button[data-access-action]")) {
      if (["invertColors", "grayHues", "underlineLinks", "bigCursor", "readingGuide", "disableAnimations"].includes(button.dataset.accessAction ?? ""))
        button.setAttribute("aria-pressed", String(button.classList.contains("active")));
    }
    if (open !== wasOpen) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (open && !menu.classList.contains("close") && document.activeElement === icon)
          menu.querySelector<HTMLButtonElement>("._menu-close-btn")?.focus();
        else if (!open && menu.classList.contains("close")) icon.focus({ preventScroll: true });
      }));
      wasOpen = open;
    }
  };
  synchronize();
  const observer = new MutationObserver(synchronize);
  observer.observe(menu, { attributes: true, attributeFilter: ["class"], subtree: true });
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !menu.classList.contains("close")) {
      event.preventDefault(); widget.toggleMenu();
    }
    if (event.key === " " && event.target instanceof HTMLElement && (event.target === icon || menu.contains(event.target))) event.preventDefault();
  };
  const keyup = (event: KeyboardEvent) => {
    if (event.key === " " && event.target instanceof HTMLElement && (event.target === icon || menu.contains(event.target))) {
      event.preventDefault();
      event.target.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    }
  };
  icon.addEventListener("keydown", keydown);
  icon.addEventListener("keyup", keyup);
  menu.addEventListener("keydown", keydown);
  menu.addEventListener("keyup", keyup);
  return () => {
    observer.disconnect();
    icon.removeEventListener("keydown", keydown); icon.removeEventListener("keyup", keyup);
    menu.removeEventListener("keydown", keydown); menu.removeEventListener("keyup", keyup);
    widget.resetAll(); widget.destroy();
  };
}
