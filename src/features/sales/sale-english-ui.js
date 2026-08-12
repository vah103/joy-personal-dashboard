const SALE_SCOPE_SELECTOR = "#sales, #sales-modal, #sales-assistant-modal, #room-summary-card, .sale-page";

const EXACT_TEXT = new Map([
  ["Hẹn khách xem phòng", "Schedule a room viewing"],
  ["Tạo lịch, theo dõi lịch sử và tóm tắt thông tin phòng ngay trong Joy.", "Create appointments, review history, and prepare room summaries directly in Joy."],
  ["Hẹn khách", "Appointments"],
  ["Tóm tắt phòng", "Room summary"],
  ["Lịch sử", "History"],
  ["Thông tin lịch hẹn", "Appointment details"],
  ["Joy hiểu “30p nữa”, “mai 8h tối”, “ngày kia”, “giờ khách qua” và ngày dạng 28/07.", "Joy understands Vietnamese phrases such as “30p nữa”, “mai 8h tối”, “ngày kia”, “giờ khách qua”, and dates like 28/07."],
  ["Tạo lịch hẹn", "Create appointment"],
  ["Kiểm tra trước khi lưu", "Review before saving"],
  ["Joy lịch hẹn", "Joy appointment"],
  ["Tên khách", "Customer name"],
  ["Số điện thoại", "Phone"],
  ["Địa chỉ xem phòng", "Viewing address"],
  ["Thời gian", "Viewing time"],
  ["Nhập lại", "Start over"],
  ["Lưu lịch", "Save appointment"],
  ["Thông tin phòng nguồn", "Source room information"],
  ["Số điện thoại, tên nguồn, link và hoa hồng sẽ được loại khỏi bản gửi khách.", "Phone numbers, source names, links, and commission details are removed from the customer view."],
  ["Xóa", "Delete"],
  ["Tạo tóm tắt", "Create summary"],
  ["Bản gửi khách", "Customer view"],
  ["Sẵn sàng chụp màn hình", "Ready to screenshot"],
  ["Chế độ chụp", "Screenshot view"],
  ["Chạm vào nội dung đã tạo để sửa trước khi chụp.", "Tap any generated text to edit it before taking a screenshot."],
  ["Lịch hẹn được lưu trong Joy", "Appointments saved in Joy"],
  ["Đang tải…", "Loading…"],
  ["Làm mới", "Refresh"],
  ["Đang tải lịch sử…", "Loading history…"],
  ["Tóm tắt thông tin phòng", "Room information summary"],
  ["Lịch sử hẹn khách", "Viewing history"],
  ["Chưa rõ thời gian", "Time not recognized"],
  ["Joy đã tách thông tin. Hãy kiểm tra lại trước khi lưu.", "Joy parsed the details. Please review them before saving."],
  ["Vui lòng nhập địa chỉ xem phòng.", "Please enter the viewing address."],
  ["Vui lòng chọn thời gian hẹn.", "Please choose a viewing time."],
  ["Thời gian hẹn đã qua. Hãy chọn lại.", "That viewing time has already passed. Please choose another time."],
  ["Joy chỉ nhận lịch trong vòng 1 năm tới.", "Joy only accepts appointments within the next year."],
  ["Không tìm thấy lịch hẹn này.", "This appointment could not be found."],
  ["Joy chưa xác định được lịch cần sửa.", "Joy could not identify the appointment to edit."],
  ["Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại Joy.", "Your Joy session has expired. Please sign in again."],
  ["Joy chưa thể lưu lịch. Hãy thử lại.", "Joy could not save the appointment. Please try again."],
  ["Đang lưu lịch vào Joy…", "Saving appointment to Joy…"],
  ["Sắp tới", "Upcoming"],
  ["Đã huỷ", "Cancelled"],
  ["Đã qua", "Past"],
  ["Đã gửi", "Sent"],
  ["Không nhắc", "No reminder"],
  ["Chờ gửi", "Pending"],
  ["Sửa", "Edit"],
  ["Lưu", "Save"],
  ["Huỷ", "Cancel"],
  ["Chưa có lịch hẹn nào trong Joy.", "No appointments have been saved in Joy yet."],
  ["Khách", "Customer"],
  ["SĐT", "Phone"],
  ["Địa chỉ", "Address"],
  ["Trạng thái", "Status"],
  ["Nhắc 30p", "30 min reminder"],
  ["Điền đủ tên, địa chỉ và thời gian.", "Please enter the customer name, address, and viewing time."],
  ["Đang lưu…", "Saving…"],
  ["Joy chưa tải được lịch sử. Hãy thử lại.", "Joy could not load the history. Please try again."],
  ["Không tải được", "Could not load"],
  ["Nhắc", "Reminder"],
  ["Đã follow-up", "Follow-up sent"],
  ["Chờ follow-up", "Follow-up pending"],
  ["Đã nhắc", "Reminder sent"],
  ["Chờ nhắc", "Reminder pending"],
  ["Không nhắc trước", "No advance reminder"],
  ["Đang xóa…", "Deleting…"],
  ["Chưa xóa được. Hãy thử lại.", "Could not delete the appointment. Please try again."],
  ["Đang cập nhật trạng thái chốt…", "Updating deal status…"],
  ["Đã chốt · chưa nhận hoa hồng.", "Closed · commission pending."],
  ["Đã nhận hoa hồng.", "Commission received."],
  ["Chưa cập nhật được trạng thái chốt. Hãy thử lại.", "Could not update the deal status. Please try again."],
  ["Chốt", "Close deal"],
  ["Chạm vào một dòng để chỉnh sửa", "Tap a row to edit it"],
  ["Nhấp đúp vào một dòng để chỉnh sửa", "Double-click a row to edit it"],
  ["Phòng trống", "Available rooms"],
  ["Giá phòng", "Room prices"],
  ["Địa chỉ chưa rõ", "Address not specified"],
  ["Giá", "Price"],
  ["Dạng phòng", "Room type"],
  ["Thang máy", "Elevator"],
  ["Nội thất", "Furniture"],
  ["Dịch vụ", "Services"],
  ["Lưu ý", "Notes"],
  ["Điện", "Electricity"],
  ["Nước", "Water"],
  ["Mạng", "Internet"],
  ["Dịch vụ chung", "Common services"],
  ["Gửi xe", "Parking"],
  ["Tủ lạnh", "Fridge"],
  ["Giặt sấy", "Laundry"],
  ["Khác", "Other"],
  ["Vào luôn", "Available now"],
  ["Đang trống", "Available now"],
  ["AI đang kiểm tra chính tả…", "AI is polishing the text…"],
  ["Đã kiểm tra chính tả bằng AI", "AI polish complete"],
]);

const ATTRIBUTE_TEXT = new Map([
  ["Đóng Sale Assistant", "Close Sale Assistant"],
  ["Ví dụ: 8h tối mai chị Lan 0987654321 xem phòng 180 Phú Mỹ", "Example (Vietnamese input): 8h tối mai chị Lan 0987654321 xem phòng 180 Phú Mỹ"],
  ["Ví dụ: 180 Phú Mỹ còn phòng 302 giá 4tr2, vào luôn. Full nội thất, thang máy. Điện 4k, nước 100k/người...", "Example (Vietnamese source): 180 Phú Mỹ còn phòng 302 giá 4tr2, vào luôn. Full nội thất, thang máy. Điện 4k, nước 100k/người..."],
  ["Chạm để sửa lịch hẹn này", "Tap to edit this appointment"],
  ["Nhấp đúp hoặc nhấn Enter để sửa lịch hẹn này", "Double-click or press Enter to edit this appointment"],
  ["Đã chốt, chưa nhận hoa hồng. Bấm lần nữa khi đã nhận tiền.", "Closed, commission not received yet. Press again when payment is received."],
  ["Đã nhận hoa hồng.", "Commission received."],
  ["Chốt khách này.", "Close this deal."],
]);

function preserveWhitespace(source, replacement) {
  const leading = source.match(/^\s*/u)?.[0] || "";
  const trailing = source.match(/\s*$/u)?.[0] || "";
  return `${leading}${replacement}${trailing}`;
}

export function translateSaleUiText(value) {
  const source = String(value ?? "");
  const text = source.trim();
  if (!text) return source;
  const exact = EXACT_TEXT.get(text);
  if (exact) return preserveWhitespace(source, exact);

  let match = text.match(/^(\d+)\s+lịch hẹn$/u);
  if (match) return preserveWhitespace(source, `${match[1]} ${Number(match[1]) === 1 ? "appointment" : "appointments"}`);

  match = text.match(/^Chưa nhận ra (.+)\. Bạn có thể điền trực tiếp bên dưới\.$/u);
  if (match) {
    const missing = match[1]
      .replace(/tên khách/giu, "customer name")
      .replace(/địa chỉ/giu, "address")
      .replace(/thời gian/giu, "viewing time");
    return preserveWhitespace(source, `Could not recognize ${missing}. You can fill it in below.`);
  }

  match = text.match(/^(\d+)\s+phòng(?:\s*·\s*Trống từ\s+(.+)|\s*·\s*Vào luôn)?$/iu);
  if (match) {
    const suffix = match[2] ? ` · Available from ${match[2]}` : /Vào luôn/iu.test(text) ? " · Available now" : "";
    return preserveWhitespace(source, `${match[1]} rooms${suffix}`);
  }

  match = text.match(/^Từ\s+(.+)$/iu);
  if (match) return preserveWhitespace(source, `From ${match[1]}`);

  match = text.match(/^(.+)\s+\(trống\s+(.+)\)$/iu);
  if (match) return preserveWhitespace(source, `${match[1]} (available from ${match[2]})`);

  if (text.startsWith("Đã lưu lịch. Joy sẽ nhắc bạn trước 30 phút và hỏi lại sau buổi xem.")) {
    return preserveWhitespace(source, text.replace(
      "Đã lưu lịch. Joy sẽ nhắc bạn trước 30 phút và hỏi lại sau buổi xem.",
      "Appointment saved. Joy will remind you 30 minutes before the viewing and follow up afterward.",
    ));
  }
  if (text.startsWith("Đã lưu lịch. Lịch quá sát giờ để nhắc trước 30 phút; Joy vẫn sẽ hỏi lại sau buổi xem.")) {
    return preserveWhitespace(source, text.replace(
      "Đã lưu lịch. Lịch quá sát giờ để nhắc trước 30 phút; Joy vẫn sẽ hỏi lại sau buổi xem.",
      "Appointment saved. It is too close to send a 30-minute reminder, but Joy will still follow up afterward.",
    ));
  }

  return source;
}

function translateAttribute(element, name) {
  const value = element.getAttribute?.(name);
  if (!value) return;
  const translated = ATTRIBUTE_TEXT.get(value) || translateSaleUiText(value);
  if (translated !== value) element.setAttribute(name, translated);
}

function historyNodeReady(node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const row = element?.closest?.(".sales-history-table tbody tr");
  if (row && row.dataset.reminderMerged !== "true") return false;
  const table = element?.closest?.(".sales-history-table");
  if (table && element?.closest?.("thead") && table.querySelectorAll("thead th").length >= 8) return false;
  return true;
}

function translateTextNode(node) {
  if (!historyNodeReady(node)) return;
  const parent = node.parentElement;
  if (!parent || parent.closest("textarea, input, script, style")) return;
  const translated = translateSaleUiText(node.nodeValue);
  if (translated !== node.nodeValue) node.nodeValue = translated;
}

function translateRoomDetails(root) {
  root.querySelectorAll?.(".room-share-detail-row").forEach((row) => {
    const label = row.querySelector("strong")?.textContent?.replace(/:\s*$/u, "").trim();
    if (label !== "Elevator") return;
    const value = row.querySelector(".room-share-detail-value");
    if (!value) return;
    const clean = value.textContent.trim().toLocaleLowerCase("vi");
    if (clean === "có" || clean === "co") value.textContent = "Yes";
    if (clean === "không" || clean === "khong") value.textContent = "No";
  });
}

export function translateSaleUiRoot(root) {
  if (!root) return;
  const element = root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement;
  const inScope = element?.matches?.(SALE_SCOPE_SELECTOR) || element?.closest?.(SALE_SCOPE_SELECTOR);
  const containsScope = element?.querySelector?.(SALE_SCOPE_SELECTOR);
  if (!inScope && !containsScope) return;

  const scopeRoot = inScope ? element : containsScope;
  if (!scopeRoot) return;
  const walker = document.createTreeWalker(scopeRoot, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(translateTextNode);

  scopeRoot.querySelectorAll?.("[placeholder], [aria-label], [title]").forEach((item) => {
    translateAttribute(item, "placeholder");
    translateAttribute(item, "aria-label");
    translateAttribute(item, "title");
  });
  translateAttribute(scopeRoot, "placeholder");
  translateAttribute(scopeRoot, "aria-label");
  translateAttribute(scopeRoot, "title");
  translateRoomDetails(scopeRoot);
}

export function installSaleEnglishUi(doc = document) {
  if (!doc?.body || doc.body.dataset.saleEnglishUi === "true") return;
  doc.body.dataset.saleEnglishUi = "true";
  translateSaleUiRoot(doc.body);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") translateSaleUiRoot(mutation.target);
      if (mutation.type === "attributes") translateSaleUiRoot(mutation.target);
      mutation.addedNodes?.forEach((node) => translateSaleUiRoot(node));
      translateSaleUiRoot(mutation.target);
    });
  });
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "aria-label", "title"],
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => installSaleEnglishUi(document), { once: true });
  } else {
    installSaleEnglishUi(document);
  }
}
