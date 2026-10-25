const wsUrl = process.argv[2];
const mode = process.argv[3] || "measure";

if (!wsUrl) {
  console.error("Usage: node scripts/check-cdp.cjs <webSocketDebuggerUrl>");
  process.exit(1);
}

let id = 0;
const pending = new Map();
const socket = new WebSocket(wsUrl);

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const call = { id: ++id, method, params };
    pending.set(call.id, { resolve, reject });
    socket.send(JSON.stringify(call));
  });
}

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const waiting = pending.get(message.id);
  if (!waiting) return;
  pending.delete(message.id);
  if (message.error) {
    waiting.reject(new Error(message.error.message));
    return;
  }
  waiting.resolve(message);
});

socket.addEventListener("open", async () => {
  await send("Page.enable");
  if (mode === "mobile-menu") {
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    });
  }

  await send("Runtime.enable");
  if (mode === "mobile-menu") {
    await send("Runtime.evaluate", {
      expression: `document.querySelector(".mobile-menu-button")?.click()`,
      returnByValue: true,
    });
  }

  const expression = `(() => {
    const vw = innerWidth;
    const menu = document.querySelector(".mobile-nav");
    const menuButton = document.querySelector(".mobile-menu-button");
    const offenders = Array.from(document.querySelectorAll("*"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          cls: String(el.className || ""),
          text: String(el.innerText || el.alt || "").slice(0, 80),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width)
        };
      })
      .filter((o) => o.left < -1 || o.right > vw + 1)
      .slice(0, 30);

    return {
      vw,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      dir: document.documentElement.dir,
      menuHidden: menu ? menu.hidden : null,
      menuOpenClass: menu ? menu.className : null,
      menuExpanded: menuButton ? menuButton.getAttribute("aria-expanded") : null,
      menuLinkCount: menu ? menu.querySelectorAll("a").length : 0,
      offenders
    };
  })()`;

  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });

  const value = result.result?.result?.value ?? result.result?.value ?? result;
  console.log(JSON.stringify(value, null, 2));
  socket.close();
});

socket.addEventListener("error", (error) => {
  console.error(error.message || error);
  process.exit(1);
});
