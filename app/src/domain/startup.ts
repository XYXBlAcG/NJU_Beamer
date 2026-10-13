export function startupView(state: { hasDocument: boolean; sessionReady: boolean; listenerReady: boolean; externalOpening: boolean; hasRecovery: boolean }): "document" | "loading" | "recovery" | "welcome" {
  if (state.hasDocument) return "document";
  if (!state.sessionReady || !state.listenerReady || state.externalOpening) return "loading";
  return state.hasRecovery ? "recovery" : "welcome";
}
