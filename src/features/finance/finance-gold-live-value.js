(() => {
  const panel = document.querySelector("#finance");
  if (!panel) return;

  const GOLD_PRICE_ENDPOINT = "/api/finance/gold-price";
  const GOLD_HELD_TAEL = 0.05;
  const CHI_PER_TAEL = 10;
  const QUOTE_MAX_AGE_MS = 5 * 60 * 1000;

  let displayMode = "weight";
  let quote = null;
  let quoteFetchedAt = 0;
  let loading = false;
  let lastError = "";

  function formatGoldHolding() {
    return `${GOLD_HELD_TAEL.toFixed(2)} tael`;
  }

  function calculateGoldValueVnd(buyPricePerChi) {
    return Math.round(Number(buyPricePerChi || 0) * GOLD_HELD_TAEL * CHI_PER_TAEL);
  }

  function currentElements() {
    const asset = panel.querySelector(".finance-year-end-gold");
    return {
      asset,
      value: asset?.querySelector("[data-finance-value]") || null,
    };
  }

  function setDisplayedValue(valueElement, displayValue) {
    if (!valueElement) return;
    valueElement.dataset.financeValue = displayValue;
    valueElement.textContent = financeValuesHidden
      ? valueElement.dataset.financeMask || "•••"
      : displayValue;
  }

  function quoteDetails() {
    if (!quote) return "";
    const sourceTime = quote.updatedAtSource ? ` · Updated ${quote.updatedAtSource}` : "";
    const stale = quote.stale ? " · cached quote" : "";
    return `Buy-back price from Bảo Tín Mạnh Hải${sourceTime}${stale}`;
  }

  function renderGoldValue() {
    const { asset, value } = currentElements();
    if (!asset || !value) return;

    asset.classList.toggle("is-loading", loading);
    asset.classList.toggle("is-live-value", displayMode === "value" && Boolean(quote));
    asset.classList.toggle("is-error", Boolean(lastError));
    asset.setAttribute("aria-busy", loading ? "true" : "false");

    if (loading) {
      setDisplayedValue(value, "Updating…");
      asset.title = "Updating gold price from Bảo Tín Mạnh Hải";
      asset.setAttribute("aria-label", "Updating current gold value");
      return;
    }

    if (displayMode === "value" && quote) {
      const currentValue = calculateGoldValueVnd(quote.buyPricePerChi);
      const formattedValue = formatVnd(currentValue);
      setDisplayedValue(value, formattedValue);
      asset.title = `${quoteDetails()} · Click to show 0.05 tael`;
      asset.setAttribute(
        "aria-label",
        `Current gold value ${formattedValue}. Click to show gold weight.`,
      );
      return;
    }

    setDisplayedValue(value, formatGoldHolding());
    asset.title = lastError
      ? "Could not update the gold price. Click to try again."
      : "Click to show the current buy-back value from Bảo Tín Mạnh Hải";
    asset.setAttribute(
      "aria-label",
      lastError
        ? "Gold holding 0.05 tael. Price update failed. Click to try again."
        : "Gold holding 0.05 tael. Click to show the current value.",
    );
  }

  async function requestGoldQuote() {
    const response = await fetch(GOLD_PRICE_ENDPOINT, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new Error(`GOLD_PRICE_HTTP_${response.status}`);
    const payload = await response.json();
    const buyPricePerChi = Number(payload?.buyPricePerChi || 0);
    if (!Number.isFinite(buyPricePerChi) || buyPricePerChi <= 0) {
      throw new Error("GOLD_PRICE_INVALID");
    }

    return { ...payload, buyPricePerChi };
  }

  async function showLiveGoldValue() {
    const quoteIsFresh = quote && Date.now() - quoteFetchedAt < QUOTE_MAX_AGE_MS;
    displayMode = "value";
    lastError = "";

    if (quoteIsFresh) {
      renderGoldValue();
      return;
    }

    loading = true;
    renderGoldValue();

    try {
      quote = await requestGoldQuote();
      quoteFetchedAt = Date.now();
    } catch (error) {
      console.error("Joy could not update the live gold value", error);
      displayMode = "weight";
      lastError = "GOLD_PRICE_UNAVAILABLE";
    } finally {
      loading = false;
      renderGoldValue();
    }
  }

  function toggleGoldValue() {
    if (loading) return;
    if (displayMode === "value") {
      displayMode = "weight";
      lastError = "";
      renderGoldValue();
      return;
    }
    void showLiveGoldValue();
  }

  function handleGoldChipClick(event) {
    event.preventDefault();
    event.stopPropagation();
    toggleGoldValue();
  }

  function handleGoldChipKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    toggleGoldValue();
  }

  function enhanceGoldChip() {
    const { asset, value } = currentElements();
    if (!asset || !value) return;

    value.setAttribute("aria-live", "polite");
    if (asset.dataset.financeGoldLiveBound !== "true") {
      asset.dataset.financeGoldLiveBound = "true";
      asset.setAttribute("role", "button");
      asset.setAttribute("tabindex", "0");
      asset.addEventListener("click", handleGoldChipClick);
      asset.addEventListener("keydown", handleGoldChipKeydown);
    }

    renderGoldValue();
  }

  document.addEventListener("joy:finance-dashboard-rendered", enhanceGoldChip);
  enhanceGoldChip();
})();
