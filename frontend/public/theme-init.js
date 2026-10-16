// Runs before first paint (loaded from <head>): applies the saved theme to <html> so there is no flash.
// Keep in sync with lib/theme.ts (key "ls-theme": light | dark | system; default LIGHT. "ls-text-size": 100 | 112.5 | 125. "ls-contrast": high).
(function () {
  try {
    var m = null, s = null, c = null;
    try {
      m = window.localStorage.getItem("ls-theme");
      s = window.localStorage.getItem("ls-text-size");
      c = window.localStorage.getItem("ls-contrast");
    } catch (e) {}
    var dark = m === "dark" || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("contrast", c === "high");
    document.documentElement.style.fontSize = s === "112.5" || s === "125" ? s + "%" : "";
  } catch (e) {}
})();
