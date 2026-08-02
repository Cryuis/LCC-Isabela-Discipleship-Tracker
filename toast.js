function showToast(message, type = "success") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");

  const messageEl = document.createElement("span");
  messageEl.className = "toast-message";
  messageEl.textContent = message;
  toast.appendChild(messageEl);

  const close = document.createElement("button");
  close.className = "toast-close";
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "\u00d7";
  close.addEventListener("click", () => dismiss(toast));
  toast.appendChild(close);

  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  const timer = setTimeout(() => dismiss(toast), 4000);

  function dismiss(element) {
    clearTimeout(timer);
    element.classList.remove("show");
    element.classList.add("hide");
    setTimeout(() => element.remove(), 300);
  }
}
