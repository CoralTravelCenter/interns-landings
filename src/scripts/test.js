export default function initElement() {
  const host = document.querySelector("#test");
  if (!host) return;

  const element = document.createElement("span");
  element.innerHTML = "<br> А я текст из скрипта";

  host.appendChild(element);
}
