let region = null;

export function showToast(message, type = "info") {
  if (!region) {
    region = document.createElement("div");
    region.className = "imt-toast-region";
    document.documentElement.append(region);
  }

  const toast = document.createElement("div");
  toast.className = `imt-toast imt-toast-${type}`;
  toast.textContent = message;
  region.append(toast);

  window.setTimeout(() => {
    toast.remove();
    if (region && region.childElementCount === 0) {
      region.remove();
      region = null;
    }
  }, 3000);
}
