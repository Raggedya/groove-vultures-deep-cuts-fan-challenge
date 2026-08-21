export const MAHOGANY_SECRET_SCREEN_STATES = Object.freeze([
  "closed",
  "opening",
  "open",
  "closing",
]);

export const MAHOGANY_SECRET_SCREEN_TRANSITIONS = Object.freeze({
  closed: Object.freeze({ TOGGLE: "opening", RESET: "closed" }),
  opening: Object.freeze({ ARRIVE: "open", RESET: "closed" }),
  open: Object.freeze({ TOGGLE: "closing", RESET: "closed" }),
  closing: Object.freeze({ ARRIVE: "closed", RESET: "closed" }),
});

export function transitionMahoganySecretScreen(state, event) {
  return MAHOGANY_SECRET_SCREEN_TRANSITIONS[state]?.[event] || state;
}
