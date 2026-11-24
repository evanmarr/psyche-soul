/* Applies the saved theme and text size before the page paints (loaded in <head>). */
(function () {
  var d = document.documentElement, t = "dark", s = "normal";
  try { t = localStorage.getItem("psTheme") || "dark"; s = localStorage.getItem("psSize") || "normal"; } catch (e) { }
  d.dataset.theme = t === "light" ? "light" : "dark";
  d.dataset.size = s === "large" || s === "xl" ? s : "normal";
})();
