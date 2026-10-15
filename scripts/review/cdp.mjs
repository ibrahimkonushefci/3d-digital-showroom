// Minimal CDP client using Node's built-in WebSocket.
export async function connect(port = 9333) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  let page = list.find((t) => t.type === "page");
  if (!page)
    page = await (
      await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
        method: "PUT",
      })
    ).json();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id);
      pending.delete(d.id);
      d.error ? p.j(new Error(JSON.stringify(d.error))) : p.r(d.result);
    } else listeners.forEach((l) => l(d));
  };
  const send = (method, params = {}) =>
    new Promise((r, j) => {
      const i = ++id;
      pending.set(i, { r, j });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expr) => {
    const r = await send("Runtime.evaluate", {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (file, clip) => {
    const fs = await import("node:fs");
    const r = await send("Page.captureScreenshot", {
      format: "png",
      ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
    });
    fs.writeFileSync(file, Buffer.from(r.data, "base64"));
  };
  return { send, evaluate, sleep, shot, ws, on: (f) => listeners.push(f) };
}
