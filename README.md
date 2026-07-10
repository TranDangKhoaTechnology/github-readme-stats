# GitHub Readme Stats — Render Edition

<div align="center">

Tạo thẻ thống kê GitHub dạng SVG động để nhúng vào README.

Được duy trì bởi **TranDangKhoaTechnology** và tối ưu để triển khai trên **Render**.

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?logo=render&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

## Giới thiệu

Dự án cung cấp các endpoint tạo ảnh SVG từ dữ liệu GitHub và WakaTime. Bạn có thể hiển thị thống kê tài khoản, ngôn ngữ sử dụng nhiều nhất, repository, gist và hoạt động WakaTime trực tiếp trong README GitHub.

Phiên bản này sử dụng Express, Node.js 22 và có sẵn cấu hình Render. Cấu hình Vercel cũ đã được loại bỏ.

## Địa chỉ đang chạy

Service hiện tại:

**https://github-readme-stats-12.onrender.com**

| Chức năng | Endpoint |
| --- | --- |
| Trạng thái service | `/` |
| Health check | `/health` |
| Thống kê GitHub | `/api?username=<username>` |
| Ngôn ngữ phổ biến | `/api/top-langs?username=<username>` |
| Thẻ repository | `/api/pin?username=<username>&repo=<repository>` |
| Thẻ gist | `/api/gist?id=<gist-id>` |
| Thẻ WakaTime | `/api/wakatime?username=<username>` |

## Sử dụng nhanh

Thay `<username>`, `<repository>` và `<gist-id>` bằng thông tin của bạn.

### Thẻ thống kê GitHub

```md
![GitHub Stats](https://github-readme-stats-12.onrender.com/api?username=<username>&show_icons=true)
```

### Thẻ ngôn ngữ

```md
![Top Languages](https://github-readme-stats-12.onrender.com/api/top-langs?username=<username>&layout=compact)
```

### Thẻ repository

```md
![Repository](https://github-readme-stats-12.onrender.com/api/pin?username=<username>&repo=<repository>)
```

### Thẻ gist

```md
![Gist](https://github-readme-stats-12.onrender.com/api/gist?id=<gist-id>)
```

### Thẻ WakaTime

Tài khoản WakaTime phải có profile công khai.

```md
![WakaTime](https://github-readme-stats-12.onrender.com/api/wakatime?username=<username>)
```

## Tùy chỉnh thẻ

Các tham số phổ biến có thể nối vào URL bằng `&`.

| Tham số | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `theme` | Chọn giao diện màu | `theme=radical` |
| `show_icons` | Hiện biểu tượng thống kê | `show_icons=true` |
| `hide_title` | Ẩn tiêu đề | `hide_title=true` |
| `hide_border` | Ẩn đường viền | `hide_border=true` |
| `border_radius` | Độ bo góc | `border_radius=12` |
| `title_color` | Màu tiêu đề dạng hex | `title_color=58a6ff` |
| `text_color` | Màu chữ dạng hex | `text_color=c9d1d9` |
| `icon_color` | Màu biểu tượng dạng hex | `icon_color=f0883e` |
| `bg_color` | Màu nền dạng hex | `bg_color=0d1117` |
| `border_color` | Màu viền dạng hex | `border_color=30363d` |
| `locale` | Ngôn ngữ hiển thị | `locale=vi` |
| `custom_title` | Tiêu đề tùy chỉnh | `custom_title=My%20Stats` |
| `disable_animations` | Tắt hiệu ứng SVG | `disable_animations=true` |
| `cache_seconds` | Thời gian cache yêu cầu | `cache_seconds=86400` |

Ví dụ:

```md
![GitHub Stats](https://github-readme-stats-12.onrender.com/api?username=<username>&show_icons=true&theme=radical&hide_border=true)
```

### Tùy chọn riêng cho thẻ thống kê

| Tham số | Mô tả |
| --- | --- |
| `hide` | Ẩn các mục, ví dụ `hide=issues,contribs` |
| `show` | Hiện thống kê bổ sung như `reviews`, `prs_merged` hoặc `discussions_started` |
| `hide_rank` | Ẩn xếp hạng |
| `rank_icon` | Kiểu biểu tượng xếp hạng |
| `include_all_commits` | Tính commit ở tất cả năm |
| `commits_year` | Chỉ tính commit của một năm |
| `exclude_repo` | Loại trừ repository khỏi phép tính |

### Tùy chọn riêng cho thẻ ngôn ngữ

| Tham số | Mô tả |
| --- | --- |
| `layout` | `normal`, `compact`, `donut`, `donut-vertical` hoặc `pie` |
| `langs_count` | Số ngôn ngữ cần hiển thị |
| `hide` | Ẩn một hoặc nhiều ngôn ngữ |
| `exclude_repo` | Bỏ qua một hoặc nhiều repository |
| `hide_progress` | Ẩn thanh tiến trình |
| `stats_format` | `percentages` hoặc `bytes` |
| `size_weight` | Trọng số theo kích thước mã nguồn |
| `count_weight` | Trọng số theo số repository |

Danh sách theme có sẵn nằm trong [themes/README.md](themes/README.md).

## Triển khai lên Render

### 1. Tạo GitHub Personal Access Token

Ứng dụng cần ít nhất một token để gọi GitHub API.

1. Mở [GitHub Personal Access Tokens](https://github.com/settings/tokens).
2. Tạo token mới.
3. Nếu chỉ đọc dữ liệu công khai, chỉ cấp các quyền đọc cần thiết.
4. Nếu muốn thống kê repository hoặc đóng góp riêng tư, token classic cần quyền `repo` và `read:user`.
5. Sao chép token ngay sau khi tạo.

Không ghi token vào mã nguồn, README, commit hoặc log. Token phải được lưu dưới dạng biến môi trường bí mật trên Render.

### 2. Triển khai bằng Blueprint

Repository có sẵn [render.yaml](render.yaml).

1. Fork hoặc push repository này lên GitHub của bạn.
2. Mở [Render Dashboard](https://dashboard.render.com/).
3. Chọn **New → Blueprint**.
4. Kết nối repository.
5. Nhập giá trị bí mật cho biến `PAT_1`.
6. Tạo Blueprint và chờ quá trình deploy hoàn tất.

### 3. Tạo Web Service thủ công

Nếu không dùng Blueprint, hãy nhập đúng các thông số sau:

| Render setting | Giá trị |
| --- | --- |
| Runtime | `Node` |
| Branch | `main` |
| Build Command | `yarn` |
| Start Command | `yarn start` |
| Health Check Path | `/health` |

Sau khi deploy, kiểm tra:

```text
https://<service-name>.onrender.com/
https://<service-name>.onrender.com/health
https://<service-name>.onrender.com/api?username=octocat
```

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `PAT_1` | Có với thẻ GitHub | GitHub Personal Access Token đầu tiên |
| `PAT_2`, `PAT_3`, ... | Không | Token dự phòng khi token trước chạm giới hạn API; phải đánh số liên tục |
| `PORT` | Render tự đặt | Cổng Express lắng nghe |
| `NODE_VERSION` | Nên đặt | Phiên bản Node.js, mặc định của dự án là 22 |
| `CACHE_SECONDS` | Không | Ghi đè thời gian cache cho toàn bộ thẻ |
| `WHITELIST` | Không | Danh sách username được phép, phân tách bằng dấu phẩy và không có khoảng trắng |
| `GIST_WHITELIST` | Không | Danh sách gist ID được phép |
| `EXCLUDE_REPO` | Không | Danh sách repository bị loại trừ |
| `FETCH_MULTI_PAGE_STARS` | Không | Đặt `true` để lấy thêm trang repository khi tính sao |
| `NODE_ENV` | Không | Đặt `development` để tắt cache khi phát triển local |

Sau khi thay đổi biến môi trường trên Render, lưu thay đổi và redeploy service.

Thời gian cache mặc định: Stats 1 ngày, Top Languages 6 ngày, Repository 10 ngày, Gist 2 ngày và WakaTime 1 ngày. `CACHE_SECONDS` sẽ ghi đè các giá trị này.

## Lưu ý dữ liệu

- Top Languages chỉ phân tích tối đa 100 repository do người dùng sở hữu, không tính fork và không đại diện cho trình độ lập trình.
- Thẻ repository không hiển thị repository riêng tư, kể cả khi token có quyền truy cập.
- Thẻ WakaTime sử dụng API công khai của WakaTime, không cần PAT GitHub nhưng profile WakaTime phải công khai.
- Card lỗi cũng được trả về dưới dạng SVG; hãy mở trực tiếp URL ảnh để đọc thông báo lỗi.
- Cache có thể khiến dữ liệu chưa thay đổi ngay sau khi cập nhật GitHub hoặc cấu hình service.

## Chạy trên máy cá nhân

Yêu cầu:

- Node.js 22 trở lên
- Yarn
- GitHub Personal Access Token

Cài dependency:

```bash
yarn
```

Tạo file `.env`:

```env
PAT_1=github_pat_your_token
NODE_ENV=development
PORT=9000
```

Khởi động:

```bash
yarn start
```

Mở:

```text
http://localhost:9000/
http://localhost:9000/health
http://localhost:9000/api?username=octocat
```

Ứng dụng cũng hỗ trợ lệnh `node src/index.js` để tương thích với các dịch vụ tự chọn entrypoint.

## Kiểm tra mã nguồn

```bash
yarn lint
yarn test
yarn test:e2e
yarn format:check
```

## Cấu trúc chính

```text
api/             Các route tạo SVG
src/cards/       Thành phần dựng thẻ
src/fetchers/    Lấy dữ liệu GitHub và WakaTime
src/common/      Cache, lỗi, màu sắc và tiện ích dùng chung
themes/          Danh sách theme
tests/           Unit test
express.js       Web server dùng trên Render
render.yaml      Cấu hình Render Blueprint
```

## Xử lý lỗi

### `No GitHub API tokens found`

Render chưa có biến `PAT_1`, hoặc service chưa được redeploy sau khi thêm token.

### `Bad credentials`

Token không hợp lệ, đã hết hạn hoặc bị thu hồi. Tạo token mới và cập nhật `PAT_1`.

### Ứng dụng thoát ngay sau khi deploy

Đảm bảo Start Command là `yarn start`. Dự án cũng hỗ trợ `node src/index.js`.

### URL gốc hoạt động nhưng thẻ trả lỗi

Kiểm tra `PAT_1`, quyền của token và giới hạn GitHub API. Có thể thêm `PAT_2`, `PAT_3` để dự phòng.

## Đóng góp

1. Fork repository.
2. Tạo branch cho thay đổi.
3. Chạy lint và test.
4. Commit với nội dung rõ ràng.
5. Gửi Pull Request.

## Giấy phép và ghi nhận

Dự án được phân phối theo giấy phép MIT. Bản Render và các thay đổi trong fork này được duy trì bởi **TranDangKhoaTechnology**.

Dự án được phát triển dựa trên mã nguồn [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats). Các thông báo bản quyền và điều khoản giấy phép của mã nguồn gốc vẫn được giữ theo yêu cầu của MIT.

© 2026 TranDangKhoaTechnology.
