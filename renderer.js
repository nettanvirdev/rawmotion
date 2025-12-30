// Window control button handlers
document.getElementById("minimize-btn")?.addEventListener("click", () => {
  window.electronAPI.minimize();
});

document.getElementById("maximize-btn")?.addEventListener("click", () => {
  window.electronAPI.maximize();
});

document.getElementById("close-btn")?.addEventListener("click", () => {
  window.electronAPI.close();
});
