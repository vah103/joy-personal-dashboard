(() => {
  const panel = document.querySelector("#finance");
  if (!panel) return;

  const ENGLISH_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function installDashboardStyles() {
    if (document.querySelector("#joy-finance-dashboard-v1")) return;

    const style = document.createElement("style");
    style.id = "joy-finance-dashboard-v1";
    style.textContent = `
      #finance.finance-dashboard-polished .panel-heading{
        min-height:70px;
        padding:15px 20px;
        align-items:center;
      }

      #finance.finance-dashboard-polished .panel-title-button{
        color:#2d4249;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:20px;
        font-weight:700;
        letter-spacing:-.035em;
        line-height:1;
      }

      #finance.finance-dashboard-polished .finance-heading-actions{
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:11px;
      }

      #finance.finance-dashboard-polished .finance-period-button{
        min-width:132px;
        min-height:38px;
        padding:9px 15px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:12px;
        border:1px solid rgba(61,78,83,.15);
        border-radius:13px;
        background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(246,243,237,.82));
        color:#314850;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:12px;
        font-weight:700;
        letter-spacing:-.015em;
        box-shadow:0 7px 18px rgba(48,61,65,.11),inset 0 1px rgba(255,255,255,.9);
        cursor:pointer;
        transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;
      }

      #finance.finance-dashboard-polished .finance-period-button::after{
        content:"⌄";
        margin-top:-3px;
        color:#607279;
        font-size:15px;
        font-weight:700;
      }

      #finance.finance-dashboard-polished .finance-period-button:hover{
        transform:translateY(-1px);
        border-color:rgba(55,83,91,.28);
        box-shadow:0 10px 22px rgba(48,61,65,.14),inset 0 1px rgba(255,255,255,.94);
      }

      #finance.finance-dashboard-polished .finance-privacy-toggle{
        width:38px;
        height:38px;
        border-radius:13px;
        background:rgba(255,255,255,.68);
      }

      #finance.finance-dashboard-polished .finance-overview{
        min-height:164px;
        padding:22px 20px;
        grid-template-columns:minmax(175px,1.42fr) repeat(3,minmax(112px,1fr));
        align-items:stretch;
      }

      #finance.finance-dashboard-polished .finance-available{
        padding:0 20px 0 0;
      }

      #finance.finance-dashboard-polished .finance-available>span{
        color:#68797e;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:9px;
        font-weight:700;
        letter-spacing:.11em;
      }

      #finance.finance-dashboard-polished .finance-available>strong,
      #finance.finance-dashboard-polished .finance-overview-stat strong{
        overflow:visible;
        color:#2e454d;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-variant-numeric:tabular-nums lining-nums;
        font-weight:700;
        letter-spacing:-.045em;
        line-height:1;
        white-space:nowrap;
      }

      #finance.finance-dashboard-polished .finance-available>strong{
        min-height:42px;
        margin:10px 0 9px;
        font-size:clamp(28px,3vw,38px);
      }

      #finance.finance-dashboard-polished .finance-available>small{
        gap:0;
        color:#5d846b;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:9px;
        font-weight:600;
      }

      #finance.finance-dashboard-polished .finance-available>small i,
      #finance.finance-dashboard-polished .finance-stat-icon{
        display:none;
      }

      #finance.finance-dashboard-polished .finance-available>small b{
        color:#5d846b;
        font-size:9px;
        font-weight:650;
      }

      #finance.finance-dashboard-polished .finance-overview-stat{
        padding:15px 14px;
        display:flex;
        align-items:center;
        border-left:1px solid rgba(67,73,74,.12);
      }

      #finance.finance-dashboard-polished .finance-overview-stat>span:last-child{
        width:100%;
        min-width:0;
      }

      #finance.finance-dashboard-polished .finance-overview-stat small{
        color:#66777c;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:9px;
        font-weight:650;
      }

      #finance.finance-dashboard-polished .finance-overview-stat strong{
        min-height:22px;
        margin-top:8px;
        font-size:clamp(16px,1.42vw,20px);
      }

      #finance.finance-dashboard-polished .finance-overview-stat em{
        margin-top:7px;
        overflow:visible;
        color:#849093;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:8px;
        font-weight:500;
        line-height:1.3;
        white-space:normal;
      }

      #finance.finance-dashboard-polished .finance-pulse-heading strong{
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:12px;
        font-weight:700;
        letter-spacing:-.015em;
      }

      #finance.finance-dashboard-polished .finance-pulse-heading small{
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:8px;
        font-weight:500;
      }

      #finance.finance-dashboard-polished .finance-months{
        color:#718085;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:7.5px;
        font-weight:550;
      }

      #finance.finance-dashboard-polished .finance-months i.is-current{
        color:#2f464e;
        font-weight:750;
      }

      #finance.finance-dashboard-polished.finance-values-hidden [data-finance-value],
      #finance.finance-dashboard-polished .finance-values-hidden [data-finance-value]{
        font-family:"Instrument Sans",Arial,sans-serif;
        letter-spacing:0;
      }

      @media(max-width:760px){
        #finance.finance-dashboard-polished .panel-heading{
          align-items:flex-start;
        }

        #finance.finance-dashboard-polished .finance-period-button{
          min-width:116px;
          padding-inline:12px;
        }

        #finance.finance-dashboard-polished .finance-overview{
          grid-template-columns:1fr 1fr;
        }

        #finance.finance-dashboard-polished .finance-available{
          grid-column:1/-1;
          padding:0 0 17px;
          border-bottom:1px solid rgba(67,73,74,.11);
        }

        #finance.finance-dashboard-polished .finance-overview-stat:nth-of-type(2){
          border-left:0;
        }
      }
    `;
    document.head.append(style);
  }

  function makeMonthButton() {
    const headingActions = panel.querySelector(".finance-heading-actions");
    if (!headingActions) return;

    headingActions.querySelector(".finance-add-expense")?.remove();
    headingActions.querySelector("[data-finance-open]")?.remove();

    let period = headingActions.querySelector("#finance-period");
    if (!period) return;

    if (period.tagName !== "BUTTON") {
      const button = document.createElement("button");
      button.id = "finance-period";
      button.className = "finance-period finance-period-button";
      button.type = "button";
      button.textContent = period.textContent;
      button.setAttribute("aria-label", "Open monthly Finance details");
      period.replaceWith(button);
      period = button;
    } else {
      period.classList.add("finance-period-button");
    }

    if (period.dataset.financePeriodBound !== "true") {
      period.dataset.financePeriodBound = "true";
      period.addEventListener("click", () => openFinanceWorkspace("month"));
    }
  }

  function useFullDashboardAmounts() {
    if (typeof setMoneyValue !== "function" || setMoneyValue.__joyFullAmounts) return;

    const fullValueSetter = function setFullDashboardMoneyValue(element, amount) {
      if (!element) return;
      element.dataset.financeValue = formatVnd(amount);
      element.textContent = financeValuesHidden ? element.dataset.financeMask : element.dataset.financeValue;
    };
    fullValueSetter.__joyFullAmounts = true;
    setMoneyValue = fullValueSetter;
  }

  function useEnglishChartMonths() {
    const labels = panel.querySelector("#finance-months");
    if (!labels) return;

    [...labels.children].forEach((label, index) => {
      label.textContent = ENGLISH_MONTHS[index] || label.textContent;
    });
  }

  function polishFinanceDashboard() {
    panel.classList.add("finance-dashboard-polished");
    makeMonthButton();
    useEnglishChartMonths();
  }

  installDashboardStyles();
  useFullDashboardAmounts();

  if (typeof renderFinanceDashboard === "function" && !renderFinanceDashboard.__joyDashboardPolished) {
    const originalRenderFinanceDashboard = renderFinanceDashboard;
    const polishedRenderFinanceDashboard = function renderPolishedFinanceDashboard(...args) {
      const result = originalRenderFinanceDashboard.apply(this, args);
      polishFinanceDashboard();
      return result;
    };
    polishedRenderFinanceDashboard.__joyDashboardPolished = true;
    renderFinanceDashboard = polishedRenderFinanceDashboard;
  }

  polishFinanceDashboard();
  if (typeof financeSummary !== "undefined" && financeSummary) renderFinanceDashboard();
})();
