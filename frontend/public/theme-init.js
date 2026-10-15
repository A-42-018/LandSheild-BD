// Runs before first paint (loaded from <head>): applies the saved theme + text size to <html> so there is no flash.
// Keep in sync with lib/theme.ts (key "ls-theme": light | dark | system; default LIGHT. key "ls-text-size": 100 | 112.5 | 125).
(function () {
  try {
    var m = null, s = null;
    try { m = window.localStorage.getItem("ls-theme"); s = window.localStorage.getItem("ls-text-size"); } catch (e) {}
    if (m && document.cookie.indexOf("ls-theme=") === -1) document.cookie = "ls-theme=" + m + "; path=/; max-age=31536000; SameSite=Lax";
    var dark = m === "dark" || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    if (s === "112.5" || s === "125") document.documentElement.style.fontSize = s + "%";
  } catch (e) {}
})();
