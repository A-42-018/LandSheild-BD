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
    if (m && document.cookie.indexOf("ls-theme=") === -1) document.cookie = "ls-theme=" + m + "; path=/; max-age=31536000; SameSite=Lax";
    var dark = m === "dark" || (m === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.fontSize = "";
  } catch (e) {}
})();
