(() => {
  const panel = document.querySelector("#finance");
  if (!panel) return;

  const ENGLISH_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function installDashboardStyles() {
    if (document.querySelector("#joy-finance-dashboard-v3")) return;

    const style = document.createElement("style");
    style.id = "joy-finance-dashboard-v3";
    style.textContent = `
      #finance.finance-dashboard-polished{
        container-type:inline-size;
      }

      #finance.finance-dashboard-polished .panel-heading{
        min-height:74px;
        padding:16px 20px;
        align-items:center;
      }

      #finance.finance-dashboard-polished .panel-title-button{
        color:#2e454d;
      }

      #finance.finance-dashboard-polished .finance-heading-actions{
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:11px;
      }

      #finance.finance-dashboard-polished .finance-period-button{
        min-width:152px;
        min-height:43px;
        padding:10px 17px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:13px;
        border:1px solid rgba(61,78,83,.16);
        border-radius:14px;
        background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(246,243,237,.84));
        color:#314850;
        font-family:"Instrument Sans",Arial,sans-serif!important;
        font-size:15px;
        font-weight:700!important;
        letter-spacing:-.025em!important;
        box-shadow:0 8px 20px rgba(48,61,65,.12),inset 0 1px rgba(255,255,255,.92);
        cursor:pointer;
        transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease;
      }

      #finance.finance-dashboard-polished .finance-period-button::after{
        content:"⌄";
        margin-top:-3px;
        color:#607279;
        font-size:17px;
        font-weight:700;
      }

      #finance.finance-dashboard-polished .finance-period-button:hover{
        transform:translateY(-1px);
        border-color:rgba(55,83,91,.3);
        box-shadow:0 11px 24px rgba(48,61,65,.15),inset 0 1px rgba(255,255,255,.96);
      }

      #finance.finance-dashboard-polished .finance-privacy-toggle{
        width:40px;
        height:40px;
        border-radius:13px;
        background:rgba(255,255,255,.68);
      }

      #finance.finance-dashboard-polished .finance-overview{
        min-height:178px;
        padding:18px 20px 20px;
        display:grid;
        grid-template-columns:minmax(218px,1.48fr) minmax(122px,.82fr) minmax(150px,1fr);
        grid-template-rows:repeat(2,minmax(68px,1fr));
        align-items:stretch;
        gap:10px 13px;
      }

      #finance.finance-dashboard-polished .finance-available{
        position:relative;
        grid-column:1;
        grid-row:1 / 3;
        min-width:0;
        min-height:0;
        padding:20px 22px 20px 25px;
        overflow:hidden;
        display:flex;
        flex-direction:column;
        justify-content:center;
        border:1px solid rgba(78,112,122,.18);
        border-radius:16px;
        background:linear-gradient(140deg,rgba(239,247,248,.98),rgba(248,245,238,.82));
        box-shadow:0 9px 22px rgba(46,72,81,.065),inset 0 1px rgba(255,255,255,.85);
      }

      #finance.finance-dashboard-polished .finance-available::before{
        position:absolute;
        inset:18px auto 18px 0;
        width:3px;
        border-radius:0 99px 99px 0;
        background:#5b8490;
        content:"";
      }

      #finance.finance-dashboard-polished .finance-available>span{
        color:#687b81;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:10px;
        font-weight:700;
        letter-spacing:.105em;
      }

      #finance.finance-dashboard-polished .finance-available>strong,
      #finance.finance-dashboard-polished .finance-overview-stat strong{
        overflow:visible;
        color:#2f4851;
        font-family:"OpenAI Sans","Instrument Sans","Segoe UI",Arial,sans-serif;
        font-synthesis:none;
        font-variant-numeric:proportional-nums lining-nums;
        letter-spacing:-.012em;
        white-space:nowrap;
      }

      #finance.finance-dashboard-polished .finance-available>strong{
        min-height:0;
        margin:10px 0 9px;
        font-size:clamp(34px,3.25vw,41px);
        font-weight:500;
        line-height:1.08;
      }

      #finance.finance-dashboard-polished .finance-available>small{
        gap:0;
        color:#5d846b;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:9px;
        font-weight:600;
        line-height:1.35;
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
        min-width:0;
        min-height:0;
        padding:11px 12px;
        display:flex;
        align-items:center;
        border:1px solid rgba(67,83,88,.105);
        border-radius:12px;
        background:rgba(255,255,255,.34);
        box-shadow:inset 0 1px rgba(255,255,255,.62);
      }

      #finance.finance-dashboard-polished .finance-overview>.finance-overview-stat:nth-child(2){
        grid-column:2;
        grid-row:1;
      }

      #finance.finance-dashboard-polished .finance-overview>.finance-overview-stat:nth-child(3){
        grid-column:2;
        grid-row:2;
      }

      #finance.finance-dashboard-polished .finance-overview>.finance-overview-stat:nth-child(4){
        grid-column:3;
        grid-row:1 / 3;
        padding:18px 17px;
        border-color:rgba(91,112,94,.14);
        border-radius:15px;
        background:linear-gradient(145deg,rgba(248,248,244,.85),rgba(235,242,236,.72));
      }

      #finance.finance-dashboard-polished .finance-overview-stat>span:last-child{
        width:100%;
        min-width:0;
      }

      #finance.finance-dashboard-polished .finance-overview-stat small{
        color:#60747a;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:10.5px;
        font-weight:700;
      }

      #finance.finance-dashboard-polished .finance-overview-stat strong{
        min-height:0;
        margin-top:6px;
        font-size:clamp(19px,1.75vw,24px);
        font-weight:400;
        line-height:1.12;
      }

      #finance.finance-dashboard-polished .finance-overview>.finance-overview-stat:nth-child(4) strong{
        margin-top:8px;
        font-size:clamp(20px,1.8vw,23px);
      }

      #finance.finance-dashboard-polished .finance-overview-stat em{
        margin-top:6px;
        overflow:visible;
        color:#7e8b8e;
        font-family:"Instrument Sans",Arial,sans-serif;
        font-size:7.5px;
        font-weight:550;
        line-height:1.35;
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
        font-size:8.2px;
        font-weight:600;
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

      @container (max-width:540px){
        #finance.finance-dashboard-polished .finance-overview{
          grid-template-columns:repeat(2,minmax(0,1fr));
          grid-template-rows:auto;
          gap:10px;
          padding:15px;
        }

        #finance.finance-dashboard-polished .finance-available{
          grid-column:1 / -1;
          grid-row:auto;
          min-height:128px;
        }

        #finance.finance-dashboard-polished .finance-overview>.finance-overview-stat:nth-child(2),
        #finance.finance-dashboard-polished .finance-overview>.finance-overview-stat:nth-child(3){
          grid-row:auto;
          min-height:78px;
        }

        #finance.finance-dashboard-polished .finance-overview>.finance-overview-stat:nth-child(2){
          grid-column:1;
        }

        #finance.finance-dashboard-polished .finance-overview>.finance-overview-stat:nth-child(3){
          grid-column:2;
        }

        #finance.finance-dashboard-polished .finance-overview>.finance-overview-stat:nth-child(4){
          grid-column:1 / -1;
          grid-row:auto;
          min-height:92px;
        }
      }

      @media(max-width:760px){
        #finance.finance-dashboard-polished .panel-heading{
          align-items:flex-start;
        }

        #finance.finance-dashboard-polished .finance-period-button{
          min-width:128px;
          min-height:40px;
          padding-inline:13px;
          font-size:13px;
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

  function useEnglishChartMonths() {
    const labels = panel.querySelector("#finance-months");
    if (!labels) return;

    [...labels.children].forEach((label, index) => {
      const desired = ENGLISH_MONTHS[index];
      if (desired && label.textContent !== desired) label.textContent = desired;
    });
  }

  function polishFinanceDashboard() {
    panel.classList.add("finance-dashboard-polished");
    makeMonthButton();
    useEnglishChartMonths();
  }

  installDashboardStyles();
  document.addEventListener("joy:finance-chart-rendered", useEnglishChartMonths);
  document.addEventListener("joy:finance-dashboard-rendered", polishFinanceDashboard);

  polishFinanceDashboard();
  if (typeof financeSummary !== "undefined" && financeSummary) renderFinanceDashboard();
})();
