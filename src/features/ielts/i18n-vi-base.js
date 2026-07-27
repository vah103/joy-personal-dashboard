const IELTS_LANGUAGE = "vi-VN";

const SESSION_LABEL = {
  morning: "Buổi sáng",
  afternoon: "Buổi chiều",
  evening: "Buổi tối",
  daily: "Hằng ngày",
  review: "Ôn tập",
};

const EVIDENCE_LABEL = {
  submission: "Bài nộp",
  notes: "Ghi chú",
  practice_record: "Bản ghi luyện tập",
  score: "Điểm số",
  reflection: "Tự đánh giá",
  confirmation: "Xác nhận",
  checklist: "Danh sách kiểm tra",
  saved_profile: "Hồ sơ đã lưu",
  diagnostic_results: "Kết quả đầu vào",
};

const WEEKDAY_LABEL = {
  Monday: "Thứ Hai",
  Tuesday: "Thứ Ba",
  Wednesday: "Thứ Tư",
  Thursday: "Thứ Năm",
  Friday: "Thứ Sáu",
  Saturday: "Thứ Bảy",
  Sunday: "Chủ Nhật",
};

const CONFIDENCE_LABEL = {
  low: "độ tin cậy thấp",
  medium: "độ tin cậy trung bình",
  high: "độ tin cậy cao",
};

const SEVERITY_LABEL = {
  low: "nhẹ",
  medium: "trung bình",
  high: "nghiêm trọng",
};

const ERROR_CATEGORY_LABEL = {
  Task: "Đáp ứng đề",
  Coherence: "Mạch lạc",
  Vocabulary: "Từ vựng",
  Grammar: "Ngữ pháp",
};

const PLAN_VI = {
  title: "Tăng tốc IELTS tháng 8",
  primaryGoal: "Đưa Writing tiến gần band 6.0, duy trì Speaking hằng ngày và giữ nhịp Reading, Listening.",
  preferences: [
    "Cấu trúc học rõ ràng theo ngày",
    "Theo dõi nghiêm túc",
    "Luyện Speaking ngắn mỗi ngày",
    "Giai đoạn đầu dịch ngược Việt–Anh cho Writing",
    "Bài tập gắn với trải nghiệm cá nhân",
  ],
  knownSpeakingContext: [
    "Đồ án tốt nghiệp TurtleBot4",
    "Kỳ thực tập robotics",
    "Chuyến đi Vũng Tàu",
    "Việc học đại học và đồ án tốt nghiệp",
  ],
  prelaunch: {
    "prep-read-rules": "Đọc quy tắc tháng 8",
    "prep-study-windows": "Xác nhận khung giờ học sáng và tối",
    "prep-notifications": "Bật thông báo của Joy",
    "prep-materials": "Chuẩn bị tài liệu đầu vào và không gian yên tĩnh để thu âm",
    "prep-profile": "Hoàn thiện Hồ sơ người học IELTS",
    "prep-diagnostic": "Hoàn thành đánh giá đầu vào bốn kỹ năng",
  },
  weeks: {
    "week-1": {
      dateRange: "03–09 Thg 8",
      title: "Nền tảng",
      writingFocus: "Bài Opinion, phát triển đoạn văn và biểu đồ đường",
      speakingFocus: "Part 1: Work/Study, Hometown và Accommodation",
      readingFocus: "Matching Headings và True/False/Not Given",
      listeningFocus: "Section 1–2, chính tả và dự đoán từ cần điền",
      outcomes: [
        "Viết được một body paragraph phát triển đầy đủ",
        "Hoàn thành một Task 2 và một bài viết lại",
        "Trả lời Part 1 trong 3–4 câu",
        "Tạo hai mục trong Story Bank",
      ],
    },
    "week-2": {
      dateRange: "10–16 Thg 8",
      title: "Tự làm độc lập",
      writingFocus: "Discussion, Advantages–Disadvantages và biểu đồ đường/cột/bảng",
      speakingFocus: "Part 2: người, địa điểm và trải nghiệm",
      readingFocus: "Multiple Choice và Matching Information",
      listeningFocus: "Section 3–4, bẫy nhiễu và Note Completion",
      outcomes: [
        "Lập dàn ý trực tiếp bằng tiếng Anh",
        "Hoàn thành Task 2 trong 40–50 phút",
        "Nói liên tục trong hai phút",
        "Có bốn đến năm mục trong Story Bank",
      ],
    },
    "week-3": {
      dateRange: "17–23 Thg 8",
      title: "Kiểm soát thời gian",
      writingFocus: "Problems–Solutions, Two-part Questions, Process và Map",
      speakingFocus: "Part 3: nguyên nhân, ảnh hưởng, so sánh và giải pháp",
      readingFocus: "Sentence/Summary Completion và Yes/No/Not Given",
      listeningFocus: "Làm trọn section không tạm dừng và phục hồi sau khi lỡ đáp án",
      outcomes: [
        "Viết gần như hoàn toàn không cần dịch",
        "Hoàn thành một bài thi thử Writing đầy đủ",
        "Duy trì Part 2 ít nhất 90 giây",
        "Xác định dạng yếu nhất của Reading và Listening",
      ],
    },
    "week-4": {
      dateRange: "24–30 Thg 8",
      title: "Ổn định khi làm bài thi",
      writingFocus: "Tốc độ, độ ổn định và giảm lỗi lặp lại",
      speakingFocus: "Chủ đề hỗn hợp và phản hồi không chuẩn bị trước",
      readingFocus: "Chiến lược ba passage và quản lý thời gian",
      listeningFocus: "Full test, chính tả và khả năng tập trung",
      outcomes: [
        "Hoàn thành bài thi thử Writing đầy đủ lần hai",
        "Hoàn thành bài thi thử Speaking đầy đủ",
        "Áp dụng chiến lược phục hồi dưới áp lực thời gian",
        "Chuẩn bị tổng kết cuối tháng",
      ],
    },
  },
};

const DAYS_VI = {};
