/**
 * Dark mode for the Swagger page, and the two lines that stop the browser from
 * fighting it.
 *
 * The symptom was an Authorize dialog on a white surface inside an otherwise
 * dark page. The cause is not Swagger: swagger-ui.css has no alternating row
 * colours at all. It is the browser's *forced* dark mode (Chrome's auto-dark, or
 * a dark-mode extension), which repaints what it recognises and leaves the rest —
 * modals especially — as authored. Half the page ends up inverted.
 *
 * Two parts, and the order of blame matters:
 *
 *  1. `color-scheme: dark` tells the browser this page themes itself, so forced
 *     dark mode stands down instead of second-guessing every surface. Without
 *     this, anything below just gets re-inverted.
 *  2. swagger-ui ships a **complete** dark palette behind `html.dark-mode` —
 *     modal, inputs, tables, code blocks, buttons. {@link SWAGGER_DARK_MODE_JS}
 *     switches it on. Reusing it beats hand-writing forty overrides that drift
 *     the next time swagger-ui is upgraded.
 *
 * What is left here is only what swagger-ui does not do itself.
 */
export const SWAGGER_CUSTOM_CSS = `
:root { color-scheme: dark; }

/* The banner carries a logo and an input for a spec URL the reader already has
   open. */
.swagger-ui .topbar { display: none; }

.swagger-ui .info { margin: 24px 0; }
`;

/**
 * Switches on swagger-ui's own dark theme, which is class-driven and has no
 * `prefers-color-scheme` hook of its own.
 *
 * Unconditionally dark rather than following the OS: this page is a development
 * tool on a dark-by-default toolchain, and a conditional here would mean the
 * dialog is only verified in one of the two states.
 */
export const SWAGGER_DARK_MODE_JS =
  "document.documentElement.classList.add('dark-mode');";
