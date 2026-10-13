import { expect, it } from "vitest";
import { startupView } from "./startup";
it("waits for session and Finder handshake before the welcome screen", () => {
  const state = { hasDocument: false, sessionReady: true, listenerReady: false, externalOpening: false, hasRecovery: false };
  expect(startupView(state)).toBe("loading");
  expect(startupView({ ...state, listenerReady: true })).toBe("welcome");
  expect(startupView({ ...state, listenerReady: true, externalOpening: true })).toBe("loading");
  expect(startupView({ ...state, listenerReady: true, hasRecovery: true })).toBe("recovery");
  expect(startupView({ ...state, hasDocument: true, hasRecovery: true })).toBe("document");
});
