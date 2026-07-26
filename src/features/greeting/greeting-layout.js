(() => {
  const greeting = document.querySelector("#greeting");
  if (!greeting) return;

  function formatGreeting() {
    if (greeting.querySelector(".greeting-daypart")) return;

    const match = greeting.textContent
      .trim()
      .match(/^(Good\s+(?:morning|afternoon|evening),)\s+(Vanh\.)$/i);

    if (!match) return;

    const daypart = document.createElement("span");
    daypart.className = "greeting-daypart";

    const name = document.createElement("span");
    name.className = "greeting-name";

    const animatedWords = [...greeting.querySelectorAll(":scope > .joy-motion-word")];
    if (animatedWords.length === 3) {
      daypart.append(
        animatedWords[0],
        document.createTextNode(" "),
        animatedWords[1],
      );
      name.append(animatedWords[2]);
    } else {
      daypart.textContent = match[1];
      name.textContent = match[2];
    }

    greeting.replaceChildren(daypart, document.createTextNode(" "), name);
  }

  formatGreeting();

  const observer = new MutationObserver(formatGreeting);
  observer.observe(greeting, {
    childList: true,
    characterData: true,
    subtree: true,
  });
})();
