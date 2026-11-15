/*
 * Edufy Academy — website deployment settings.
 * You can edit this file directly in Hostinger File Manager after uploading; no rebuild is needed.
 *
 * apiBaseUrl  Where the Edufy Node.js server (API) is reachable, ending in /api.
 *             "" = use the address built into the website: https://api.edufyacademy.com/api for
 *             production builds (vite.config.ts), or /api on the same address in local development.
 *             Use "/api" when one Node.js app serves both the website and the API.
 * siteUrl     Public address of this website (used in email verification links).
 *             "" = https://edufyacademy.com in production builds, the visitor's address otherwise.
 *             localhost values are ignored unless the page itself is opened on localhost.
 *
 * Only public values belong here. NEVER put a secret key in this file.
 */
window.EDUFY_CONFIG = {
  apiBaseUrl: "",
  siteUrl: ""
};
