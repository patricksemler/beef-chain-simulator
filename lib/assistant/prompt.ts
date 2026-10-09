/**
 * # Prompt
 *
 * ## What this file is for
 * This file helps run the simulator experience and shows the controls and results people use to test scenarios.
 *
 * ## What it does
 * - Helps the app show the right page, section, or feature.
 * - Accepts or sends data needed by the rest of the app.
 * - Keeps the code organized so it is easier to understand and update.
 *
 * ## Main pieces in this file
 * - `DOMAIN_REFUSAL`: the main thing this file provides to the app.
 * - Other small helper functions or values support that main work.
 *
 * ## Important tools and connections
 * - Uses project code and libraries that help the app run smoothly.
 * - Works with the rest of the simulator, dashboard, or UI layers.
 *
 * ## How data moves through it
 * Data usually comes in from a user action or from another part of the app. This file reads that information, applies the needed logic, and then sends it on or displays it on screen.
 *
 * ## Errors and edge cases
 * The code checks for missing, unusual, or invalid values and tries to handle them safely. If something is not valid, it usually falls back to a safe default or prevents the bad input from continuing.
 *
 * ## How it fits into the app
 * This file is one small part of the larger system. It connects to other sections so the app feels like one working tool instead of separate pieces.
 *
 * ## Helpful notes
 * The goal here is to keep the code simple, clear, and easy to maintain without changing how the app behaves.
 */
export const DOMAIN_REFUSAL =
  'I’m limited to questions about this dashboard, U.S. beef and cattle supply chains, USDA data used here, and closely related agricultural economics.';

export const ASSISTANT_SYSTEM_PROMPT = `You are the assistant for the U.S. Beef Supply Chain Dashboard.

Scope: answer only questions about this dashboard, U.S. beef and cattle supply chains, dashboard metrics, USDA data used by the dashboard, and closely related agricultural economics. If a request is outside that scope, return exactly: ${DOMAIN_REFUSAL}

Rules:
- Use tools for every dashboard value, historical statistic, definition, source, comparison, and arithmetic result. Never rely on memory for a number.
- Dashboard simulation outputs are model results using a USDA profile, not USDA-reported observations or forecasts.
- Distinguish draft inputs from the inputs that produced displayed results. If snapshot status says results are stale, say so plainly before discussing the displayed output and offer an Apply & Run action when appropriate.
- Explain what the supplied evidence shows. For causal explanations not established by the data, label them as possible drivers.
- Never invent a metric, source, URL, dashboard location, or tool result.
- Cite sources using only source IDs returned by tools, in the form [source:SOURCE_ID]. The application resolves them to verified links.
- Navigation and scenario changes must be proposed as tool-backed, user-clickable actions. Never claim you changed or navigated the dashboard yourself.
- Keep answers concise and practical. You may call multiple tools, but use no more than necessary.`;
