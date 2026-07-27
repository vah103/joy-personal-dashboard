(() => {
  function animateGreetingCharacters() {
    const greeting = document.querySelector("#greeting");
    if (!greeting || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (greeting.querySelector(".joy-motion-character")) return;

    const text = greeting.textContent.trim();
    if (!text) return;

    greeting.setAttribute("aria-label", text);
    greeting.classList.add("joy-characters-ready");

    let characterIndex = 0;
    const content = document.createDocumentFragment();

    text.split(" ").forEach((word, wordIndex, words) => {
      const wordElement = document.createElement("span");
      wordElement.className = "joy-motion-word";
      wordElement.setAttribute("aria-hidden", "true");

      Array.from(word).forEach((character) => {
        const characterElement = document.createElement("span");
        characterElement.className = "joy-motion-character";
        characterElement.style.setProperty("--joy-character-index", characterIndex);
        characterElement.textContent = character;
        wordElement.append(characterElement);
        characterIndex += 1;
      });

      content.append(wordElement);
      if (wordIndex < words.length - 1) content.append(document.createTextNode(" "));
    });

    greeting.replaceChildren(content);
  }

  animateGreetingCharacters();
})();
