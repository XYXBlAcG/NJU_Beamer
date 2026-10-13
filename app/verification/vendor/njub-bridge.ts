import { useEditorStore } from "../../../packages/app/src/store/store";
window.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("message", (event) => {
  if (event.source !== window.parent || event.origin !== window.location.origin) return;
  const message = event.data;
  if (message?.channel !== "njub-tikz") return;
  if (message.type === "load" && typeof message.source === "string") {
    const store = useEditorStore.getState();
    store.dispatch({ type: "NEW_DOCUMENT", source: message.source, title: "NJU TikZ" });
    for (const id of store.tabOrder) useEditorStore.getState().dispatch({ type: "CLOSE_DOCUMENT", documentId: id });
  }
  if (message.type === "save") window.parent.postMessage({ channel: "njub-tikz", type: "source", source: useEditorStore.getState().source }, window.location.origin);
});
window.parent.postMessage({ channel: "njub-tikz", type: "ready" }, window.location.origin);
