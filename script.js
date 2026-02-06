const split = document.querySelector(".split");

// приймаємо повідомлення
window.addEventListener("message", (event) => {
  if (!event.data.scrollProgress) return;

  const progress = event.data.scrollProgress;
  const maxHeight = window.innerHeight;

  split.style.height = progress * maxHeight + "px";
});

