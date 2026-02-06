const split = document.querySelector(".split"); // елемент прямокутника

window.addEventListener("message", (event) => {
  if (!event.data.scrollProgress) return;

  const progress = event.data.scrollProgress;
  split.style.height = progress * window.innerHeight + "px";
});
