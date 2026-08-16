/**
 * Theme flash guard.
 *
 * Applies the stored theme to <html> BEFORE first paint. This lives in
 * public/ as a classic (non-module, render-blocking) script rather than
 * inline in index.html, because the document CSP is `script-src 'self'` -
 * an inline script would be blocked.
 *
 * Keep it dependency-free and keep the <script> tag in <head>, above the
 * stylesheet. Moving it anywhere else reintroduces the flash.
 */
(function () {
  var root = document.documentElement;
  try {
    var theme = localStorage.getItem("rawmotion.theme") || "dark";
    if (theme === "dark" || theme === "oled") root.classList.add("dark");
    if (theme === "oled") root.classList.add("oled");

    if (localStorage.getItem("rawmotion.highContrast") === "true") {
      root.classList.add("high-contrast");
    }

    var scale = localStorage.getItem("rawmotion.textScale");
    if (scale) root.style.setProperty("--app-text-scale", scale);

    var width = localStorage.getItem("rawmotion.sidebarWidth");
    if (width) root.style.setProperty("--sidebar-width", width + "px");
  } catch (e) {
    // Private mode / storage disabled - fall back to the default theme.
    root.classList.add("dark");
  }
})();
