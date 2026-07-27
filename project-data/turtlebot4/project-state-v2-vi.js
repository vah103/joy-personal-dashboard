(() => {
  const stageTranslations = {
    "stage-1": {
      name: "Nền tảng & dữ liệu đầu vào",
      shortName: "Nền tảng",
      objective: "Thiết lập nền tảng ROS 2 an toàn, có thể quan sát và lặp lại với dữ liệu robot và bản đồ đã được kiểm chứng.",
      completionCriteria: "Các topic chính của robot, TF, LiDAR, odometry, camera và metadata bản đồ được xác nhận; hệ thống hoạt động ổn định liên tục trong 20–30 phút.",
      result: "Đã xác nhận kết nối ROS 2, pin, LiDAR, odometry và TF. Motor LiDAR được khôi phục và phát LaserScan khoảng 7,58 Hz."
    },
    "stage-2": {
      name: "Định vị & Nav2",
      shortName: "Định vị & Nav2",
      objective: "Định vị robot trên bản đồ đã lưu và điều hướng an toàn tới các goal do người vận hành chọn.",
      completionCriteria: "Định vị duy trì ổn định, dữ liệu scan khớp với bản đồ và robot hoàn thành liên tiếp ít nhất ba goal cố định sau khi khởi động hệ thống từ đầu.",
      result: "AMCL hoạt động với bản đồ lab đã lưu. Các node lifecycle của Nav2 đã được kích hoạt và robot đi tới nhiều goal; một goal không phù hợp trả về ABORTED."
    },
    "stage-3": {
      name: "Đánh giá chuẩn Nav2",
      shortName: "Benchmark Nav2",
      objective: "Đo baseline Nav2 cố định trước khi bổ sung exploration hoặc hành vi ngữ nghĩa.",
      completionCriteria: "Benchmark có thể lặp lại và báo cáo tỷ lệ goal thành công, thời gian di chuyển, độ dài đường đi, số lần recovery và các trường hợp lỗi."
    },
    "stage-4": {
      name: "Mô phỏng & kịch bản",
      shortName: "Mô phỏng",
      objective: "Xây dựng các kịch bản mô phỏng có kiểm soát để phát triển thuật toán an toàn và có thể lặp lại.",
      completionCriteria: "Mô phỏng tái hiện được cảm biến, bản đồ, vật cản và các kịch bản đánh giá cần thiết của robot."
    },
    "stage-5": {
      name: "Khám phá Frontier cơ bản",
      shortName: "Frontier cơ bản",
      objective: "Cài đặt và đánh giá phương pháp khám phá frontier hình học làm baseline.",
      completionCriteria: "Robot tự phát hiện, chấm điểm và đi tới các frontier; kết quả coverage được đo lường rõ ràng."
    },
    "stage-6": {
      name: "Nhận thức RGB-D",
      shortName: "Nhận thức RGB-D",
      objective: "Nhận diện các vật thể liên quan và ước lượng vị trí 3D từ dữ liệu RGB-D.",
      completionCriteria: "Các nhóm vật thể đã chọn được nhận diện và chuyển thành quan sát ổn định trong hệ tọa độ map."
    },
    "stage-7": {
      name: "Bản đồ ngữ nghĩa",
      shortName: "Bản đồ ngữ nghĩa",
      objective: "Duy trì biểu diễn các thực thể ngữ nghĩa gắn với bản đồ.",
      completionCriteria: "Các quan sát ngữ nghĩa được hợp nhất, loại trùng và hiển thị nhất quán trong hệ tọa độ map."
    },
    "stage-8": {
      name: "Khám phá có xét ngữ nghĩa và rủi ro",
      shortName: "Ngữ nghĩa & rủi ro",
      objective: "Chọn goal khám phá dựa trên thông tin hình học, giá trị ngữ nghĩa, chi phí đường đi, rủi ro và lịch sử thất bại.",
      completionCriteria: "Phương pháp đề xuất được cài đặt và so sánh với baseline frontier hình học trong các kịch bản đã xác định."
    },
    "stage-9": {
      name: "Tích hợp nhiệm vụ & luận văn",
      shortName: "Tích hợp & luận văn",
      objective: "Tích hợp toàn bộ nhiệm vụ, chạy thí nghiệm cuối và hoàn thiện luận văn tốt nghiệp.",
      completionCriteria: "Hệ thống end-to-end được demo, đánh giá và tài liệu hóa bằng bằng chứng có thể tái lập."
    }
  };

  const checklistTranslations = {
    "s1-connection": "Kết nối laptop và TurtleBot4 qua mạng ROS 2 của lab",
    "s1-battery": "Xác nhận dữ liệu BatteryState",
    "s1-lidar": "Xác nhận dữ liệu LiDAR và khôi phục motor khi cần",
    "s1-odom-tf": "Xác nhận odometry và chuỗi TF cần thiết",
    "s1-map": "Tạo, quản lý phiên bản bản đồ lab và lưu bằng chứng RViz",
    "s1-camera": "Xác nhận topic camera RGB/depth và xử lý lỗi chẩn đoán camera",
    "s1-timing": "Ghi lại kiểm tra QoS, timestamp và độ trễ",
    "s1-stability": "Chạy quan sát ổn định liên tục trong 20–30 phút",
    "s2-load-map": "Nạp bản đồ lab đã lưu",
    "s2-initial-pose": "Đặt và xác nhận initial pose trong RViz",
    "s2-tf": "Xác nhận map → odom → base_link",
    "s2-goals": "Hoàn thành nhiều goal Nav2 trong khu vực an toàn",
    "s2-three-goals": "Hoàn thành liên tiếp ba goal cố định",
    "s2-fresh-start": "Chạy lại Localization và Nav2 từ trạng thái khởi động sạch",
    "s2-config": "Commit các file launch/config Localization và Nav2 của dự án",
    "s3-goal-set": "Xác định bộ goal benchmark cố định và an toàn",
    "s3-logging": "Tạo quy trình ghi log và rosbag",
    "s3-runs": "Chạy nhiều lần thử trong điều kiện có thể so sánh",
    "s3-metrics": "Tổng hợp tỷ lệ thành công, thời gian, độ dài đường đi và recovery",
    "s4-world": "Chuẩn bị world mô phỏng và mô hình robot",
    "s4-sensors": "Xác nhận LiDAR, RGB-D, odometry và TF trong mô phỏng",
    "s4-scenarios": "Xác định kịch bản exploration và rủi ro có thể lặp lại",
    "s4-parity": "Ghi lại khác biệt giữa mô phỏng và robot thật",
    "s5-detect": "Phát hiện ô hoặc cụm frontier",
    "s5-score": "Cài đặt hàm chấm điểm frontier hình học",
    "s5-nav": "Gửi goal frontier an toàn qua Nav2",
    "s5-eval": "Đánh giá coverage và hành vi khi thất bại",
    "s6-camera": "Ổn định luồng RGB và depth",
    "s6-detection": "Chạy nhận diện vật thể trên ảnh RGB",
    "s6-depth": "Ước lượng depth và vị trí 3D của vật thể",
    "s6-transform": "Chuyển detection sang hệ tọa độ map",
    "s6-eval": "Đo chất lượng nhận diện và định vị",
    "s7-model": "Xác định mô hình dữ liệu bản đồ ngữ nghĩa",
    "s7-fusion": "Hợp nhất các quan sát lặp lại",
    "s7-storage": "Lưu class, vị trí, confidence và timestamp",
    "s7-viz": "Hiển thị thực thể ngữ nghĩa trong RViz",
    "s7-eval": "Đánh giá tính nhất quán và xử lý trùng lặp",
    "s8-utility": "Xác định đầy đủ hàm utility của frontier",
    "s8-semantic": "Thêm giá trị ngữ nghĩa vào điểm frontier",
    "s8-risk": "Thêm phạt rủi ro đường đi và khu vực cục bộ",
    "s8-history": "Thêm lịch sử quay lại và goal thất bại",
    "s8-integration": "Tích hợp chấm điểm với việc thực thi goal Nav2",
    "s8-comparison": "So sánh với baseline frontier",
    "s9-mission": "Tích hợp luồng nhiệm vụ end-to-end",
    "s9-experiments": "Chạy thí nghiệm cuối trên mô phỏng và robot thật",
    "s9-analysis": "Phân tích kết quả và hạn chế",
    "s9-writing": "Hoàn thiện luận văn, hình minh họa và tài liệu demo"
  };

  const commandTranslations = {
    "start-lidar": ["Khởi động motor LiDAR", "Khôi phục LiDAR khi thiết bị tồn tại nhưng motor không quay.", "Motor bắt đầu quay và /bot1/scan phát dữ liệu LaserScan."],
    "check-scan-rate": ["Kiểm tra tần số LaserScan", "Xác nhận dữ liệu LiDAR được gửi liên tục.", "Buổi lab ngày 23/07 đo được khoảng 7,58 Hz."],
    "slam": ["Khởi động SLAM", "Tạo hoặc cập nhật occupancy-grid map từ LiDAR và odometry.", "SLAM phát map khi robot được điều khiển thủ công quanh phòng lab."],
    "navigation-view": ["Mở giao diện điều hướng", "Mở cấu hình RViz dành cho điều hướng TurtleBot4.", "RViz hiển thị robot, bản đồ, scan và các lớp điều hướng."],
    "teleop": ["Điều khiển robot bằng bàn phím", "Điều khiển robot thủ công trong quá trình quét bản đồ.", "Robot chỉ di chuyển khi người vận hành có mặt và khu vực lab an toàn."],
    "save-map": ["Lưu bản đồ lab", "Lưu occupancy grid hiện tại bằng tên file có phiên bản.", "Tạo file metadata .yaml và ảnh bản đồ .pgm."],
    "localization": ["Khởi động định vị AMCL", "Định vị TurtleBot4 trên bản đồ lab đã lưu.", "Sau khi đặt 2D Pose Estimate, LiDAR khớp với bản đồ và AMCL cập nhật pose robot."],
    "nav2": ["Khởi động Nav2", "Khởi động planning, controller, behavior tree và costmap.", "Action server navigate_to_pose hoạt động sau khi lifecycle được kích hoạt."],
    "lifecycle-status": ["Kiểm tra lifecycle Nav2", "Kiểm tra các server Nav2 quan trọng đã active hay chưa.", "planner_server, controller_server và bt_navigator phải báo active [3]."],
    "lifecycle-reset": ["Reset và khởi động lại lifecycle điều hướng", "Khôi phục khi planner_server hoặc bt_navigator vẫn inactive.", "Các node lifecycle điều hướng khởi động lại và chuyển sang active."],
    "undock": ["Cho robot rời dock", "Đưa robot ra khỏi dock an toàn trước khi làm việc tại lab.", "Action kết thúc với SUCCEEDED và is_docked: false."],
    "dock": ["Cho robot về dock", "Đưa robot trở lại trạm sạc.", "Chưa được xác nhận trên laptop Dell; cần cài và source đúng action interface."]
  };

  const weekTranslations = {
    1: ["Ổn định Nav2 và nền tảng lab", "Chứng minh quy trình Định vị/Nav2 từ trạng thái khởi động sạch và thiết lập bài benchmark cố định.", "Bản đồ được quản lý phiên bản, quy trình khởi động có thể lặp lại, launch/config và benchmark 10 goal."],
    2: ["Phát hiện và gom cụm frontier", "Phát hiện ổn định các cụm frontier và tâm cụm từ OccupancyGrid.", "Node frontier_detector, marker RViz, log và flowchart."],
    3: ["Điều hướng frontier tự động", "Thực thi goal frontier qua Nav2 và tự xử lý lỗi.", "Robot tự đi liên tiếp năm goal frontier."],
    4: ["Hoàn thiện baseline và hệ thống ghi log", "Chạy exploration từ đầu đến cuối và thu các metric có thể lặp lại.", "Hai full run hợp lệ, logger CSV và cấu hình baseline chính thức."],
    5: ["Nhận diện vật thể bằng RGB-D", "Nhận diện ba nhóm vật thể và lấy depth đáng tin cậy.", "Pipeline detection, ba nhóm vật thể, threshold và bằng chứng."],
    6: ["Định vị vật thể và lập bản đồ ngữ nghĩa", "Chuyển detection sang frame map, hợp nhất bản ghi trùng và lưu bền vững.", "Cơ sở dữ liệu ngữ nghĩa, marker RViz, save/load và kết quả sai số."],
    7: ["Hàm utility frontier có xét ngữ nghĩa và rủi ro", "Chạy hàm utility ngữ nghĩa/rủi ro có thể giải thích song song với nearest-frontier.", "Hai chế độ, trọng số YAML, log điểm và một full run của phương pháp đề xuất."],
    8: ["Thí nghiệm pilot và khóa cấu hình", "Xác nhận protocol/logger và đóng băng code/config.", "Ba pilot run cho mỗi phương pháp và phiên bản experiment-v1."],
    9: ["Thí nghiệm chính thức và phân tích", "Thu dữ liệu so sánh và phân tích kết quả.", "Ít nhất mười run hợp lệ, biểu đồ, media và chương kết quả."],
    10: ["Demo, luận văn và bản phát hành cuối", "Chứng minh khả năng tái lập và hoàn thiện toàn bộ tài liệu nộp.", "Bản phát hành cuối, README, luận văn, dữ liệu, video và slide."]
  };

  const taskTranslations = {
    "w1-d1": "Ghi lại baseline đã xác nhận và chuẩn hóa cấu trúc repository.",
    "w1-d2": "Build sạch; chuẩn bị các bước kiểm tra, 10 goal cố định và bảng ghi kết quả.",
    "w1-d3": "Khởi động hệ thống từ đầu; kiểm tra input/TF; chạy và ghi kết quả 10 goal.",
    "w1-d4": "Xác nhận hoặc quét lại bản đồ, chạy ổn định 20–30 phút và commit launch/config.",
    "w1-d5": "Phân tích goal thành công/thất bại và hoàn thiện các metric benchmark.",
    "w1-d6": "Chỉ dùng khi điều kiện hoàn thành Tuần 1 vẫn chưa đạt.",
    "w1-d7": "Viết phần Nav2 và chỉ đóng Tuần 1 sau khi đạt tối thiểu 8/10 goal.",
    "w2-d1": "Xác định quy tắc frontier và mô hình dữ liệu đầu ra.",
    "w2-d2": "Cài đặt phát hiện, gom cụm, lọc frontier và marker.",
    "w2-d3": "Test frontier trực tiếp và ghi lại lỗi trong tường, nhiễu hoặc không thể tới.",
    "w2-d4": "Xác nhận tâm cụm, khoảng cách an toàn và khả năng cập nhật frontier.",
    "w2-d5": "Phân tích rosbag và ổn định log/tham số.",
    "w2-d6": "Chỉ dùng khi marker hoặc tâm frontier vẫn chưa đáng tin cậy.",
    "w2-d7": "Viết lý thuyết/flowchart frontier và tạo tag cho bản tuần.",
    "w3-d1": "Thiết kế state machine, điểm nearest-frontier và blacklist.",
    "w3-d2": "Cài đặt xử lý kết quả NavigateToPose và test bằng dữ liệu giả.",
    "w3-d3": "Xác nhận từng goal frontier đơn trước khi bật vòng lặp.",
    "w3-d4": "Chạy liên tiếp năm goal và kiểm tra khả năng phục hồi bằng blacklist.",
    "w3-d5": "Sửa goal trùng/cũ và thêm log thời gian theo trạng thái goal.",
    "w3-d6": "Tiếp tục dùng lab cho đến khi đạt năm goal frontier tự động.",
    "w3-d7": "Viết phần thuật toán baseline và state machine.",
    "w4-d1": "Xác định điều kiện dừng và metric thí nghiệm.",
    "w4-d2": "Cài đặt CSV/run ID, coverage, độ dài đường đi và quy trình reset.",
    "w4-d3": "Chạy full exploration đầu tiên từ vị trí xuất phát cố định.",
    "w4-d4": "Hoàn thành hai full run hợp lệ và khóa cấu hình baseline.",
    "w4-d5": "Vẽ coverage/đường đi/frontier và kiểm tra dữ liệu còn thiếu.",
    "w4-d6": "Dùng khi chưa có đủ hai full run hợp lệ.",
    "w4-d7": "Viết phần baseline/logger và tạo tag cho bản phát hành.",
    "w5-d1": "Chọn ba nhóm vật thể dễ mang theo và xác định metric detection.",
    "w5-d2": "Cài đặt nhận diện RGB và lấy median depth ổn định.",
    "w5-d3": "Xác nhận frame RGB/depth, timestamp, khoảng cách và góc quan sát.",
    "w5-d4": "Test khi robot di chuyển, có che khuất và khóa class/threshold.",
    "w5-d5": "Phân tích confidence/depth và cải thiện bộ lọc.",
    "w5-d6": "Dùng khi camera hoặc lựa chọn class chưa ổn định.",
    "w5-d7": "Viết phần RGB-D và object detection.",
    "w6-d1": "Xác định cấu trúc bản ghi vật thể ngữ nghĩa và ngưỡng hợp nhất.",
    "w6-d2": "Cài đặt pixel-depth → 3D, TF sang map, lưu trữ và marker.",
    "w6-d3": "Đo sai số định vị trong frame map và debug TF/timestamp.",
    "w6-d4": "Tạo, lưu và nạp lại bản đồ ngữ nghĩa gồm ba vật thể.",
    "w6-d5": "Cải thiện data association và tính sai số/tỷ lệ trùng.",
    "w6-d6": "Dùng khi TF, marker, trùng lặp hoặc lưu dữ liệu còn chưa ổn định.",
    "w6-d7": "Viết pipeline semantic mapping và tạo tag cho bản phát hành.",
    "w7-d1": "Xác định và chuẩn hóa các thành phần information, distance, semantic và risk.",
    "w7-d2": "Cài đặt hai chế độ, trọng số YAML, lịch sử và marker điểm.",
    "w7-d3": "So sánh lựa chọn goal của baseline/phương pháp mới và chạy vài goal.",
    "w7-d4": "Hoàn thành một full run của phương pháp đề xuất và chỉ tinh chỉnh trọng số có ghi chép.",
    "w7-d5": "Phân tích log và khóa trọng số pilot.",
    "w7-d6": "Dùng cho đến khi có một full run hợp lệ của phương pháp đề xuất.",
    "w7-d7": "Viết công thức utility, lý do lựa chọn và flowchart.",
    "w8-d1": "Cố định môi trường, start pose, vật thể, timeout và quy tắc run hợp lệ.",
    "w8-d2": "Tự động tạo thư mục run và chuẩn bị thứ tự chạy xen kẽ.",
    "w8-d3": "Chạy ba pilot baseline với quy trình reset giống nhau.",
    "w8-d4": "Chạy ba pilot của phương pháp đề xuất và xác nhận log utility.",
    "w8-d5": "Loại run không hợp lệ, bổ sung metric và đóng băng code/config.",
    "w8-d6": "Dùng để chạy bù pilot lỗi hoặc xác nhận phiên bản đã khóa.",
    "w8-d7": "Viết thiết kế thí nghiệm và tạo tag experiment-v1.",
    "w9-d1": "Khóa thứ tự run, checklist reset, lưu trữ và form metadata.",
    "w9-d2": "Kiểm tra lại logger và chuẩn bị vật thể, marker, thiết bị quay.",
    "w9-d3": "Mục tiêu chạy ba baseline và ba run phương pháp đề xuất chính thức.",
    "w9-d4": "Đạt năm run hợp lệ cho mỗi phương pháp và quay video cuối.",
    "w9-d5": "Làm sạch dữ liệu, tính thống kê và tạo biểu đồ so sánh.",
    "w9-d6": "Chỉ chạy thay thế các run không hợp lệ hoặc bị mất dữ liệu.",
    "w9-d7": "Viết chương kết quả và tạo tag dữ liệu cuối.",
    "w10-d1": "Hoàn thiện kết luận, hạn chế và biểu đồ; không thêm tính năng mới.",
    "w10-d2": "Viết README chạy từ cold start và kịch bản demo cuối.",
    "w10-d3": "Quay toàn bộ nhiệm vụ end-to-end từ trạng thái khởi động sạch.",
    "w10-d4": "Chạy lại theo README và backup code/config/map/data/video.",
    "w10-d5": "Hoàn thiện cấu trúc luận văn, tài liệu tham khảo và kết luận.",
    "w10-d6": "Chỉ dùng lab khi demo bị lỗi; nếu không thì hoàn thiện slide.",
    "w10-d7": "Tạo backup/bản phát hành cuối và luyện demo/bảo vệ."
  };

  const historyTranslations = [
    ["Tạo trạng thái ban đầu của dự án", "Bắt đầu đồ án TurtleBot4 khi chưa có quy trình robot nào được xác nhận."],
    ["Xác nhận kết nối robot và pin", "Laptop kết nối vào mạng ROS 2 của TurtleBot4 và dữ liệu BatteryState được xác nhận."],
    ["Xác nhận LiDAR, odometry và TF", "LiDAR, odometry và chuỗi TF cần thiết đã hoạt động."],
    ["Lưu bản đồ lab đầu tiên", "SLAM tạo occupancy map có quản lý phiên bản để dùng cho định vị."],
    ["Nạp lại bản đồ và đặt initial pose", "Bản đồ được nạp thành công và initial pose của AMCL được đặt trong RViz."],
    ["Xác nhận TF từ map tới base", "Chuỗi map → odom → base_link giúp scan khớp với bản đồ đã lưu."],
    ["Hoàn thành nhiều goal Nav2", "Các node lifecycle Nav2 được kích hoạt và robot thật đi tới nhiều goal do người vận hành chọn."]
  ];

  const exactTranslations = new Map([
    ["TurtleBot project hub", "Trung tâm dự án TurtleBot"],
    ["Semantic-risk-aware autonomous exploration", "Khám phá tự hành có xét ngữ nghĩa và rủi ro"],
    ["Connecting…", "Đang kết nối…"], ["GitHub synced", "GitHub đã đồng bộ"], ["Saved", "Đã lưu"], ["Snapshot", "Bản chụp"],
    ["Overview", "Tổng quan"], ["Roadmap", "Lộ trình"], ["Commands", "Lệnh"], ["Lab Journal", "Nhật ký lab"], ["Plan & Joy", "Kế hoạch & Joy"], ["10-Week Plan", "Kế hoạch 10 tuần"],
    ["Overall progress", "Tiến độ tổng thể"], ["Overall completion", "Tiến độ tổng thể"], ["Active 10-week scope", "Phạm vi chính 10 tuần"],
    ["Current week", "Tuần hiện tại"], ["Technical stage", "Giai đoạn kỹ thuật"], ["Timeline elapsed", "Thời gian đã trôi"], ["Time does not add progress", "Thời gian không tự làm tăng tiến độ"],
    ["Today", "Hôm nay"], ["Next planned action", "Việc tiếp theo theo kế hoạch"], ["Add next action to To-do", "Thêm việc tiếp theo vào To-do"], ["Open Google Docs plan ↗", "Mở kế hoạch Google Docs ↗"],
    ["Next robot session", "Buổi làm robot tiếp theo"], ["No lab session pending", "Chưa có buổi lab đang chờ"], ["Current completion gate", "Điều kiện hoàn thành hiện tại"], ["Current stage", "Giai đoạn hiện tại"],
    ["Scope control", "Kiểm soát phạm vi"], ["Accelerated core thesis", "Phạm vi đồ án rút gọn"], ["Progress history", "Lịch sử tiến độ"], ["From 0% to today", "Từ 0% đến hiện tại"], ["Evidence-backed only", "Chỉ ghi nhận khi có bằng chứng"],
    ["Joy project assistant", "Trợ lý dự án Joy"], ["Ask about TurtleBot4", "Hỏi Joy về TurtleBot4"], ["Project State v2 is active", "Project State v2 đang hoạt động"],
    ["Joy now combines roadmap evidence, the 10-week schedule, lab days and completion gates.", "Joy đang kết hợp bằng chứng từ lộ trình, kế hoạch 10 tuần, lịch lab và điều kiện hoàn thành."],
    ["Send", "Gửi"], ["10-week execution plan", "Kế hoạch thực hiện 10 tuần"], ["Home preparation Monday–Tuesday, robot work Wednesday–Thursday, Saturday only as a controlled buffer.", "Chuẩn bị ở nhà vào thứ Hai–Ba, làm robot vào thứ Tư–Năm và chỉ dùng thứ Bảy làm ngày dự phòng."],
    ["Open source plan ↗", "Mở kế hoạch gốc ↗"], ["Deliverable:", "Đầu ra:"], ["Loading plan…", "Đang tải kế hoạch…"], ["Connecting TurtleBot project…", "Đang kết nối dự án TurtleBot…"],
    ["Counts toward technical progress", "Có tính vào tiến độ kỹ thuật"], ["Schedule task", "Công việc theo lịch"], ["No tasks scheduled.", "Chưa có công việc."],
    ["On track", "Đúng tiến độ"], ["At risk", "Có nguy cơ chậm"], ["Behind", "Chậm tiến độ"], ["Not started", "Chưa bắt đầu"], ["Not Started", "Chưa bắt đầu"], ["In Progress", "Đang thực hiện"], ["Verification", "Đang xác minh"], ["Completed", "Hoàn thành"], ["Blocked", "Bị chặn"],
    ["GitHub live", "GitHub trực tiếp"], ["Current focus", "Trọng tâm hiện tại"], ["Next action", "Việc tiếp theo"], ["Progress", "Tiến độ"],
    ["Status", "Trạng thái"], ["Checklist", "Danh sách kiểm tra"], ["Progress is calculated automatically.", "Tiến độ được tính tự động."], ["Completion gate", "Điều kiện hoàn thành"],
    ["Results achieved", "Kết quả đã đạt"], ["Editable summary", "Tóm tắt có thể chỉnh sửa"], ["GitHub evidence stays unchanged; your summary is saved separately.", "Bằng chứng GitHub được giữ nguyên; phần tóm tắt của bạn được lưu riêng."],
    ["No verified result has been linked to this stage yet.", "Giai đoạn này chưa có kết quả đã xác minh được liên kết."], ["Verified result", "Kết quả đã xác minh"],
    ["Reusable command library", "Thư viện lệnh dùng lại"], ["All categories", "Tất cả nhóm"], ["+ Add command", "+ Thêm lệnh"], ["Not verified", "Chưa xác minh"], ["Expected result", "Kết quả mong đợi"], ["Copy", "Sao chép"], ["Edit", "Chỉnh sửa"],
    ["Read Only", "Chỉ đọc"], ["Lab Only", "Chỉ dùng ở lab"], ["Robot Motion", "Robot di chuyển"], ["Robot Service", "Dịch vụ robot"], ["Unverified", "Chưa xác minh"],
    ["Dell laptop", "Laptop Dell"], ["TurtleBot Raspberry Pi", "Raspberry Pi của TurtleBot"],
    ["Lab journal", "Nhật ký lab"], ["Open repository ↗", "Mở repository ↗"], ["Raw report ↗", "Báo cáo gốc ↗"], ["What happened", "Đã xảy ra gì"], ["What this proves", "Điều này chứng minh gì"], ["Open issues", "Vấn đề còn mở"], ["No daily report was found.", "Không tìm thấy báo cáo theo ngày."],
    ["Recommended next action", "Việc tiếp theo được đề xuất"], ["Plan title", "Tên kế hoạch"], ["Why this matters", "Vì sao việc này quan trọng"], ["Location", "Địa điểm"], ["Priority", "Mức ưu tiên"], ["High", "Cao"], ["Medium", "Trung bình"], ["Low", "Thấp"], ["Home", "Ở nhà"], ["Both", "Cả hai"], ["Reset plan", "Tạo lại kế hoạch"],
    ["What should I do today?", "Hôm nay tôi cần làm gì?"], ["What should I prepare for the next lab?", "Tôi cần chuẩn bị gì cho buổi lab tiếp theo?"], ["Am I on schedule?", "Tôi có đang đúng tiến độ không?"], ["How did progress reach this percentage?", "Vì sao tiến độ hiện tại là mức này?"],
    ["object classes", "nhóm vật thể"], ["experiment environment", "môi trường thí nghiệm"], ["Saturday only as buffer.", "Thứ Bảy chỉ dùng để dự phòng."],
    ["LiDAR", "LiDAR"], ["Motion", "Chuyển động"], ["Localization", "Định vị"], ["Docking", "Trạm sạc"]
  ]);

  const weekdayMap = { Monday: "Thứ Hai", Tuesday: "Thứ Ba", Wednesday: "Thứ Tư", Thursday: "Thứ Năm", Friday: "Thứ Sáu", Saturday: "Thứ Bảy", Sunday: "Chủ nhật", Mon: "Thứ Hai", Tue: "Thứ Ba", Wed: "Thứ Tư", Thu: "Thứ Năm", Fri: "Thứ Sáu", Sat: "Thứ Bảy", Sun: "Chủ nhật" };
  const monthMap = { Jan: "thg 1", Feb: "thg 2", Mar: "thg 3", Apr: "thg 4", May: "thg 5", Jun: "thg 6", Jul: "thg 7", Aug: "thg 8", Sep: "thg 9", Oct: "thg 10", Nov: "thg 11", Dec: "thg 12" };

  function translateDynamic(value) {
    let text = exactTranslations.get(value) || value;
    text = text.replace(/^Stage (\d+) of (\d+)$/i, "Giai đoạn $1/$2");
    text = text.replace(/^Stage (\d+) of (\d+) · (.+)$/i, "Giai đoạn $1/$2 · $3");
    text = text.replace(/^Week (\d+) of 10 · Stage (\d+) of (\d+)$/i, "Tuần $1/10 · Giai đoạn $2/$3");
    text = text.replace(/^Week (\d+):/i, "Tuần $1:");
    text = text.replace(/^(\d+)% weekly tasks$/i, "$1% công việc trong tuần");
    text = text.replace(/^(\d+)% complete$/i, "$1% hoàn thành");
    text = text.replace(/^(\d+) commands$/i, "$1 lệnh");
    text = text.replace(/^(\d+) recorded sessions?$/i, "$1 buổi đã ghi");
    text = text.replace(/^(\d+) command blocks? used$/i, "Đã dùng $1 khối lệnh");
    text = text.replace(/^Verified (.+)$/i, "Đã xác minh $1");
    text = text.replace(/Project State v2 · On track · GitHub live/g, "Project State v2 · Đúng tiến độ · GitHub trực tiếp");
    text = text.replace(/Project State v2 · At risk · GitHub live/g, "Project State v2 · Có nguy cơ chậm · GitHub trực tiếp");
    text = text.replace(/Project State v2 · Behind · GitHub live/g, "Project State v2 · Chậm tiến độ · GitHub trực tiếp");
    for (const [en, vi] of Object.entries(weekdayMap)) text = text.replace(new RegExp(`\\b${en}\\b`, "g"), vi);
    for (const [en, vi] of Object.entries(monthMap)) text = text.replace(new RegExp(`\\b${en}\\b`, "g"), vi);
    return exactTranslations.get(text) || text;
  }

  function translateTextNode(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script,style,pre,code,textarea")) return;
    const raw = node.nodeValue;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const translated = translateDynamic(trimmed);
    if (translated === trimmed) return;
    const start = raw.slice(0, raw.indexOf(trimmed));
    const end = raw.slice(raw.indexOf(trimmed) + trimmed.length);
    node.nodeValue = `${start}${translated}${end}`;
  }

  function translateDom(root = document) {
    const base = root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE ? root : document;
    const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) translateTextNode(walker.currentNode);
    const elements = base.querySelectorAll ? base.querySelectorAll("[placeholder],[aria-label],option") : [];
    elements.forEach((element) => {
      if (element.placeholder) element.placeholder = translateDynamic(element.placeholder);
      if (element.getAttribute("aria-label")) element.setAttribute("aria-label", translateDynamic(element.getAttribute("aria-label")));
      if (element.tagName === "OPTION") element.textContent = translateDynamic(element.textContent.trim());
    });
  }

  function translateSource(source) {
    if (!source || source.__joyVietnamese) return false;
    source.project = source.project || {};
    Object.assign(source.project, {
      subtitle: "Khám phá tự hành có xét ngữ nghĩa và rủi ro",
      currentFocus: "Chạy lại Localization và Nav2 từ trạng thái khởi động sạch",
      nextAction: "Hoàn thành liên tiếp ba goal Nav2 cố định và lưu bằng chứng",
      summary: "Xây dựng baseline điều hướng TurtleBot4 có thể tái lập, sau đó mở rộng với frontier exploration, nhận thức RGB-D, bản đồ ngữ nghĩa và lựa chọn goal có xét ngữ nghĩa/rủi ro."
    });
    (source.roadmap?.stages || []).forEach((stage) => {
      const tr = stageTranslations[stage.id];
      if (tr) {
        stage.name = tr.name;
        stage.shortName = tr.shortName;
        stage.objective = tr.objective;
        stage.completionCriteria = tr.completionCriteria;
        if (stage.results?.[0] && tr.result) stage.results[0].summary = tr.result;
      }
      (stage.checklist || []).forEach((item) => { if (checklistTranslations[item.id]) item.label = checklistTranslations[item.id]; });
    });
    (source.commands?.commands || []).forEach((command) => {
      const tr = commandTranslations[command.id];
      if (tr) [command.name, command.purpose, command.expectedResult] = tr;
      command.runOn = command.runOn === "Dell laptop" ? "Laptop Dell" : command.runOn === "TurtleBot Raspberry Pi" ? "Raspberry Pi của TurtleBot" : command.runOn;
      command.category = translateDynamic(command.category || "");
    });
    Object.defineProperty(source, "__joyVietnamese", { value: true, configurable: true });
    return true;
  }

  function translateProjectState(projectState) {
    if (!projectState || projectState.__joyVietnamese) return false;
    projectState.project.subtitle = "Khám phá tự hành có xét ngữ nghĩa và rủi ro";
    projectState.project.currentBlockers = [
      "Chưa ghi nhận đầy đủ khả năng chạy lại Localization/Nav2 từ fresh start và benchmark goal cố định.",
      "Cần kiểm tra bản đồ đã lưu còn phù hợp với bố trí lab hiện tại hay không."
    ];
    projectState.scope.excludedReason = "Mô phỏng tạm thời nằm ngoài phạm vi cốt lõi 10 tuần. Chỉ bổ sung lại khi tiến độ robot thật vẫn đúng kế hoạch.";
    projectState.labPolicy.rule = "Chỉ dùng thứ Bảy khi mất buổi robot, chưa đạt điều kiện hoàn thành tuần, cần chạy bù dữ liệu hoặc quay lại demo cuối.";
    (projectState.history || []).forEach((entry, index) => {
      const tr = historyTranslations[index];
      if (tr) [entry.title, entry.detail] = tr;
    });
    (projectState.weeks || []).forEach((week) => {
      const tr = weekTranslations[week.number];
      if (tr) [week.title, week.objective, week.deliverable] = tr;
      (week.days || []).forEach((day) => {
        day.label = weekdayMap[day.label] || day.label;
        day.location = day.location === "Home" ? "Ở nhà" : day.location === "Optional Lab" ? "Lab dự phòng" : day.location;
        (day.tasks || []).forEach((task) => { if (taskTranslations[task.id]) task.label = taskTranslations[task.id]; });
      });
    });
    Object.defineProperty(projectState, "__joyVietnamese", { value: true, configurable: true });
    return true;
  }

  let refreshing = false;
  function refreshVietnamese() {
    if (refreshing || typeof hubState === "undefined") return;
    refreshing = true;
    const changedSource = translateSource(hubState.source);
    const changedState = translateProjectState(hubState.projectState);
    if (changedSource || changedState) {
      try { updateTurtleBotCard(); } catch {}
      try { if (!document.querySelector("#turtlebot-hub-modal")?.hidden) renderHub(); } catch {}
    }
    translateDom(document);
    refreshing = false;
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; refreshVietnamese(); });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  const timer = setInterval(refreshVietnamese, 300);
  setTimeout(() => clearInterval(timer), 15000);
  window.addEventListener("pageshow", refreshVietnamese);
  refreshVietnamese();
})();