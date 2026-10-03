// Runs before first paint (loaded from <head>): applies the saved theme to <html> so there is no flash.
// Keep in sync with lib/theme.ts (key "ls-theme": light | dark | system).
(function () {
  try {
    var m = null;
    try { m = window.localStorage.getItem("ls-theme"); } catch (e) {}
    var dark = m === "dark" || ((m === null || m === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
