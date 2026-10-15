// Runs before first paint (loaded from <head>): applies the saved theme to <html> so there is no flash.
// Keep in sync with lib/theme.ts (key "ls-theme": light | dark | system; default LIGHT).
(function () {
  try {
    var m = null;
    try {
      m = window.localStorage.getItem("ls-theme");
      // The A-/A/A+ text-size control was removed: forget any size saved by earlier versions.
      window.localStorage.removeItem("ls-text-size");
    } catch (e) {}
    var dark = m === "dark" || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.fontSize = "";
  } catch (e) {}
})();
