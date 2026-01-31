export default function example() {
  const el = document.querySelector(".example");
  if (!el) return;

  const element = document.createElement("span");
  element.innerHTML = "<br> А я текст из скрипта";

  el.insertAdjacentElement('afterend', element);
}
