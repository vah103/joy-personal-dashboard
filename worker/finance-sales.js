const MONTHS = [
  ["Jan", "January"],
  ["Feb", "February"],
  ["Mar", "March"],
  ["Apr", "April"],
  ["May", "May"],
  ["Jun", "June"],
  ["Jul", "July"],
  ["Aug", "August"],
  ["Sep", "September"],
  ["Oct", "October"],
  ["Nov", "November"],
  ["Dec", "December"],
];

const MONTH_INDEX = new Map(MONTHS.map(([short], index) => [short.toLowerCase(), index]));

export function monthKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function monthHeading(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  const index = Number(match[2]) - 1;
  return MONTHS[index] ? `${MONTHS[index][0]} ${match[1]}` : "";
}

export function monthDisplayName(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  const index = Number(match[2]) - 1;
  return MONTHS[index] ? `${MONTHS[index][1]} ${match[1]}` : "";
}

export function parseFinanceTracker(rows, { year = 2026, selectedMonth } = {}) {
  const values = Array.isArray(rows) ? rows : [];
  const found = new Map();

  values.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, columnIndex) => {
      const parsed = parseMonthCell(cell);
      if (!parsed || parsed.year !== year) return;

      const summary = values[rowIndex + 2] || [];
      const incomeLabel = cleanText(summary[columnIndex]).toLowerCase();
      const expensesLabel = cleanText(summary[columnIndex + 2]).toLowerCase();
      found.set(monthKey(year, parsed.monthIndex), {
        key: monthKey(year, parsed.monthIndex),
        label: `${MONTHS[parsed.monthIndex][1]} ${year}`,
        shortLabel: MONTHS[parsed.monthIndex][0],
        income: incomeLabel === "income" ? toNumber(summary[columnIndex + 1]) : 0,
        expenses: expensesLabel === "expenses" ? toNumber(summary[columnIndex + 3]) : 0,
        remaining: toNumber(row[columnIndex + 2]),
      });
    });
  });

  const months = MONTHS.map(([short, full], index) => found.get(monthKey(year, index)) || ({
    key: monthKey(year, index),
    label: `${full} ${year}`,
    shortLabel: short,
    income: 0,
    expenses: 0,
    remaining: 0,
  }));
  const requested = selectedMonth && found.has(selectedMonth) ? selectedMonth : latestUsefulMonth(months);

  return {
    year,
    current: months.find((month) => month.key === requested) || months[0],
    months,
  };
}

export function parseSaleLedger(rows, year = 2026) {
  const values = Array.isArray(rows) ? rows : [];
  const headings = [];

  values.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) return;
    const columnIndex = row.findIndex((cell) => {
      const parsed = parseMonthCell(cell);
      return parsed?.year === year;
    });
    if (columnIndex === -1) return;
    const parsed = parseMonthCell(row[columnIndex]);
    headings.push({
      key: monthKey(year, parsed.monthIndex),
      monthIndex: parsed.monthIndex,
      headingIndex: rowIndex,
      headingRow: rowIndex + 1,
      headingColumn: columnIndex,
    });
  });

  const byMonth = new Map();
  const blocks = [];

  headings.forEach((heading, headingPosition) => {
    const nextHeadingIndex = headings[headingPosition + 1]?.headingIndex ?? values.length;
    let headerIndex = -1;
    for (let rowIndex = heading.headingIndex + 1; rowIndex < nextHeadingIndex; rowIndex += 1) {
      const row = values[rowIndex] || [];
      if (
        cleanText(row[1]).toLowerCase() === "address"
        && cleanText(row[2]).toLowerCase() === "customer"
        && cleanText(row[3]).toLowerCase() === "host"
      ) {
        headerIndex = rowIndex;
        break;
      }
    }

    const deals = [];
    if (headerIndex !== -1) {
      for (let rowIndex = headerIndex + 1; rowIndex < nextHeadingIndex - 1; rowIndex += 1) {
        const primary = values[rowIndex] || [];
        const detail = values[rowIndex + 1] || [];
        const address = cleanText(primary[1]);
        const customer = cleanText(primary[2]);
        const host = cleanText(primary[3]);
        const rent = toNumber(detail[1]);
        const phone = cleanText(detail[2]);
        const rate = toRate(detail[3]);

        if (!(address || customer) || !(rent || phone || rate)) continue;

        const commission = toNumber(primary[4]) || Math.round(rent * rate);
        deals.push({
          id: `${heading.key}:${rowIndex + 1}`,
          month: heading.key,
          sourceRow: rowIndex + 1,
          detailRow: rowIndex + 2,
          address,
          customer,
          host,
          rent,
          phone,
          rate,
          commission,
        });
        rowIndex += 1;
      }
    }

    const total = deals.reduce((sum, deal) => sum + deal.commission, 0);
    byMonth.set(heading.key, deals);
    blocks.push({
      ...heading,
      headerIndex,
      headerRow: headerIndex + 1,
      nextHeadingIndex,
      deals,
      total,
    });
  });

  const months = MONTHS.map(([short, full], index) => {
    const key = monthKey(year, index);
    const deals = byMonth.get(key) || [];
    return {
      key,
      label: `${full} ${year}`,
      shortLabel: short,
      total: deals.reduce((sum, deal) => sum + deal.commission, 0),
      count: deals.length,
      deals,
    };
  });

  return { year, months, blocks };
}

export function validateSaleDeal(body, { requireSourceRow = false } = {}) {
  const source = body && typeof body === "object" ? body : {};
  const month = cleanText(source.month);
  const customer = cleanText(source.customer).slice(0, 120);
  const address = cleanText(source.address).slice(0, 180);
  const host = cleanText(source.host).slice(0, 120);
  const phone = cleanText(source.phone).slice(0, 30);
  const rent = toNumber(source.rent);
  const rate = toRate(source.rate);
  const sourceRow = Number(source.sourceRow || 0);

  if (!/^2026-(0[1-9]|1[0-2])$/.test(month)) return { error: "SALE_MONTH_INVALID" };
  if (!customer) return { error: "SALE_CUSTOMER_REQUIRED" };
  if (!address) return { error: "SALE_ADDRESS_REQUIRED" };
  if (!Number.isFinite(rent) || rent <= 0 || rent > 1_000_000_000) return { error: "SALE_RENT_INVALID" };
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1) return { error: "SALE_RATE_INVALID" };
  if (requireSourceRow && (!Number.isInteger(sourceRow) || sourceRow < 1)) return { error: "SALE_ROW_INVALID" };

  return {
    value: {
      month,
      customer,
      address,
      host,
      phone,
      rent: Math.round(rent),
      rate,
      commission: Math.round(rent * rate),
      sourceRow,
    },
  };
}

function parseMonthCell(value) {
  const match = cleanText(value).match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const monthIndex = MONTH_INDEX.get(match[1].toLowerCase());
  if (monthIndex === undefined) return null;
  return { monthIndex, year: Number(match[2]) };
}

function latestUsefulMonth(months) {
  const useful = months.filter((month) => month.income || month.expenses || month.remaining);
  return useful.at(-1)?.key || months[0]?.key;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function toRate(value) {
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  const text = cleanText(value).replace("%", "").replace(",", ".");
  const number = Number(text);
  if (!Number.isFinite(number)) return 0;
  return number > 1 ? number / 100 : number;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = cleanText(value);
  if (!text) return 0;
  const normalized = text
    .replace(/\s/g, "")
    .replace(/[đ₫]/gi, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}
