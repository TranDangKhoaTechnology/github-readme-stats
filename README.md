# GitHub README Cards Generator (SVG)

Repo này dùng **GitHub Actions + Node.js** để tự động tạo các thẻ **SVG** (stats / top langs / repo pins / marketing hero) và commit vào thư mục `generated/`, sau đó bạn chỉ việc nhúng vào `README.md` (profile hoặc project).

> Mục tiêu: README nhìn “xịn”, cập nhật tự động, không phải sửa tay.

---

## 0. Ảnh demo (hiển thị ngay trong README)

> Các ảnh dưới đây sẽ hiện **ngay** nếu repo đã có file trong `generated/`.  
> Nếu bạn chưa chạy workflow, hãy chạy GitHub Actions một lần để sinh ảnh.

### Hero (marketing banner)

![Hero](generated/hero.dark.svg#gh-dark-mode-only)
![Hero](generated/hero.light.svg#gh-light-mode-only)

### Stats + Top Langs (2 cột)

<div align="center">
  <img src="generated/stats.dark.svg#gh-dark-mode-only" height="165" />
  <img src="generated/top-langs.dark.svg#gh-dark-mode-only" height="165" />
</div>

<div align="center">
  <img src="generated/stats.light.svg#gh-light-mode-only" height="165" />
  <img src="generated/top-langs.light.svg#gh-light-mode-only" height="165" />
</div>

### Repo Pins (ví dụ)

> Đổi `github-readme-stats` thành tên repo thật của bạn trong thư mục `generated/pins/`.

<div align="center">
  <img src="generated/pins/github-readme-stats.dark.svg#gh-dark-mode-only" height="120" />
  <img src="generated/pins/github-readme-stats.light.svg#gh-light-mode-only" height="120" />
</div>


---

## Mục lục

- [1. Demo nhanh](#1-demo-nhanh)
- [2. Tính năng](#2-tính-năng)
- [3. Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
- [4. Chạy bằng GitHub Actions](#4-chạy-bằng-github-actions)
- [5. Chạy local để test](#5-chạy-local-để-test)
- [6. Cách nhúng vào README](#6-cách-nhúng-vào-readme)
- [7. Marketing Hero Card](#7-marketing-hero-card)
- [8. Tuỳ biến theme / layout](#8-tuỳ-biến-theme--layout)
- [9. Troubleshooting](#9-troubleshooting)
- [10. FAQ](#10-faq)
- [11. License](#11-license)

---

## 1. Demo nhanh (tham chiếu)

Nếu bạn đã xem phần **Ảnh demo** ở trên, đây là phần tóm tắt đường dẫn file.


Sau khi chạy workflow, bạn sẽ có file như:

- `generated/stats.dark.svg`
- `generated/stats.light.svg`
- `generated/top-langs.dark.svg`
- `generated/top-langs.light.svg`
- `generated/pins/<repo>.dark.svg`
- `generated/pins/<repo>.light.svg`
- `generated/hero.dark.svg`
- `generated/hero.light.svg`

Nhúng vào README:

```md
![Stats](generated/stats.dark.svg#gh-dark-mode-only)
![Stats](generated/stats.light.svg#gh-light-mode-only)

![Top Langs](generated/top-langs.dark.svg#gh-dark-mode-only)
![Top Langs](generated/top-langs.light.svg#gh-light-mode-only)
```

---

## 2. Tính năng

- ✅ Tạo **stats card** (tổng stars, commits, PRs, issues… tuỳ repo cài).
- ✅ Tạo **top languages** (lọc ngôn ngữ, số lượng repo scan…).
- ✅ Tạo **repo pins** (thẻ cho từng repo) – tự động theo danh sách repo của owner.
- ✅ Tạo **marketing hero card** (headline + bullets + CTA) cho profile README.
- ✅ Hỗ trợ **dark/light mode**.
- ✅ Workflow tự chạy theo lịch (cron) + chạy khi push + chạy tay.
- ✅ Output là SVG → load nhanh, nhúng trực tiếp trong README.

---

## 3. Cấu trúc thư mục

```
.
├─ .github/workflows/
│  └─ cards.yml              # GitHub Actions build & commit generated/*
├─ scripts/
│  ├─ stats.mjs              # tạo stats SVG
│  ├─ top-langs.mjs          # tạo top languages SVG
│  ├─ pin-card.mjs           # tạo pin card cho 1 repo
│  ├─ pins-auto.mjs          # tạo pin cards tự động theo owner
│  ├─ pins-auto-runner.mjs   # runner hỗ trợ pins-auto
│  ├─ theme.mjs              # theme + helper (ước lượng width chữ, wrap, màu…)
│  └─ marketing.mjs          # tạo hero marketing SVG
├─ generated/
│  ├─ *.svg
│  └─ pins/*.svg
├─ README.md                 # (file này) hướng dẫn
└─ package.json              # dependencies
```

> Lưu ý: thư mục `generated/` thường được commit để README load trực tiếp từ repo.

---

## 4. Chạy bằng GitHub Actions

### 4.1. Bật workflow

Mở tab **Actions** trong repo → enable workflow (nếu GitHub đang tắt mặc định).

### 4.2. Quyền commit
Workflow sẽ commit các file SVG vào repo.  
Bạn cần đảm bảo workflow có quyền **Read and write permissions**:

- Repo → **Settings** → **Actions** → **General**
- **Workflow permissions** → chọn **Read and write permissions**

### 4.3. Trigger workflow
Workflow thường có các trigger:

- `push` lên branch `main`
- `schedule` (cron)
- `workflow_dispatch` (chạy tay)

Bạn có thể sửa `cards.yml` để đổi lịch cron theo nhu cầu.

### 4.4. Lưu ý về token
Workflow có thể dùng:
- `secrets.GITHUB_TOKEN` (mặc định của GitHub Actions) – đủ cho phần lớn nhu cầu.
- Hoặc `PAT` (Personal Access Token) nếu bạn muốn quyền rộng hơn / tránh rate limit.

Nếu dùng PAT:
- Tạo PAT có quyền đọc repo (và write nếu cần commit từ workflow).
- Thêm vào repo secrets: `GH_TOKEN` hoặc `GITHUB_TOKEN_CUSTOM`.
- Sửa workflow để dùng secret đó.

---

## 5. Chạy local để test

### 5.1. Yêu cầu
- Node.js **>= 20**
- Có token GitHub (khuyến nghị) để tránh rate limit.

### 5.2. Cài dependencies
```bash
npm install
```

### 5.3. Set token
```bash
export GITHUB_TOKEN="YOUR_TOKEN"
# Windows PowerShell: $env:GITHUB_TOKEN="YOUR_TOKEN"
```

### 5.4. Chạy stats
```bash
node scripts/stats.mjs \
  --username TranDangKhoaTechnology \
  --theme tokyonight \
  --out generated/stats.dark.svg
```

### 5.5. Chạy top langs
```bash
node scripts/top-langs.mjs \
  --username TranDangKhoaTechnology \
  --theme tokyonight \
  --langs_count 8 \
  --max_repos 40 \
  --out generated/top-langs.dark.svg
```

### 5.6. Chạy pin-card (1 repo)
```bash
node scripts/pin-card.mjs \
  --owner TranDangKhoaTechnology \
  --repo YourRepoName \
  --theme tokyonight \
  --out generated/pins/YourRepoName.dark.svg
```

### 5.7. Chạy pins-auto (tự động nhiều repo)
```bash
node scripts/pins-auto.mjs \
  --owner TranDangKhoaTechnology \
  --out_dir generated/pins \
  --theme_dark tokyonight \
  --theme_light solarized-light \
  --max_repos 200 \
  --include_forks false \
  --sort updated
```

---

## 6. Cách nhúng vào README

### 6.1. Nhúng dark/light bằng `#gh-dark-mode-only`
GitHub hỗ trợ suffix để hiển thị theo theme:

```md
![Stats](generated/stats.dark.svg#gh-dark-mode-only)
![Stats](generated/stats.light.svg#gh-light-mode-only)
```

Tương tự cho `top-langs` và `hero`.

### 6.2. Nhúng pins
Ví dụ 1 repo:

```md
![Repo Pin](generated/pins/YourRepoName.dark.svg#gh-dark-mode-only)
![Repo Pin](generated/pins/YourRepoName.light.svg#gh-light-mode-only)
```

### 6.3. Layout gợi ý (2 cột)
Bạn có thể dùng HTML để đặt 2 ảnh cạnh nhau:

```html
<div align="center">
  <img src="generated/stats.dark.svg#gh-dark-mode-only" height="165" />
  <img src="generated/top-langs.dark.svg#gh-dark-mode-only" height="165" />
</div>
```

---

## 7. Marketing Hero Card

Hero card giúp README “marketing” hơn (headline + offer + CTA).

### 7.1. Generate dark/light (local)
```bash
node scripts/marketing.mjs --style clean --out generated/hero.dark.svg \
  --title "Trần Đăng Khoa" \
  --tagline "Automation • Web Apps • AI" \
  --desc "Tôi xây hệ thống tự động hoá, landing page và chatbot để giúp bạn tăng doanh thu." \
  --badges "Open for freelance,Remote,Fast delivery" \
  --points "Tự động hoá quy trình (Sheets/CRM/Zapier),Landing page SEO + Analytics,Chatbot + API tích hợp" \
  --stats "Projects|25+,Response|<24h,Clients|10+" \
  --cta_text "Contact me" \
  --cta_url "mailto:trandangkhoa.automation@gmail.com" \
  --links "GitHub|https://github.com/TranDangKhoaTechnology,Email|mailto:trandangkhoa.automation@gmail.com"
```

```bash
node scripts/marketing.mjs --style cleanlight --out generated/hero.light.svg \
  --title "Trần Đăng Khoa" \
  --tagline "Automation • Web Apps • AI" \
  --desc "Tôi xây hệ thống tự động hoá, landing page và chatbot để giúp bạn tăng doanh thu." \
  --badges "Open for freelance,Remote,Fast delivery" \
  --points "Tự động hoá quy trình (Sheets/CRM/Zapier),Landing page SEO + Analytics,Chatbot + API tích hợp" \
  --stats "Projects|25+,Response|<24h,Clients|10+" \
  --cta_text "Contact me" \
  --cta_url "mailto:trandangkhoa.automation@gmail.com" \
  --links "GitHub|https://github.com/TranDangKhoaTechnology,Email|mailto:trandangkhoa.automation@gmail.com"
```

### 7.2. Nhúng vào README
```md
![Hero](generated/hero.dark.svg#gh-dark-mode-only)
![Hero](generated/hero.light.svg#gh-light-mode-only)
```

### 7.3. Thêm vào GitHub Actions (không bị lỗi xuống dòng)
Trong workflow, dùng `run: >-` để đảm bảo lệnh là 1 dòng:

```yml
- name: Generate hero (dark)
  run: >-
    node scripts/marketing.mjs
    --style clean
    --out generated/hero.dark.svg
    --title "Trần Đăng Khoa"
    --tagline "Automation • Web Apps • AI"
    --desc "..."
    --badges "..."
    --points "..."
    --stats "Projects|25+,Response|<24h,Clients|10+"
    --cta_text "Contact me"
    --cta_url "mailto:you@gmail.com"
    --links "GitHub|https://github.com/...,Email|mailto:you@gmail.com"
```

---

## 8. Tuỳ biến theme / layout

### 8.1. Theme
Bạn có thể đổi theme bằng `--theme <name>` (stats/top-langs/pin-card) hoặc `--style <preset>` (hero).

Ví dụ:
```bash
node scripts/top-langs.mjs --theme dracula --out generated/top-langs.dark.svg
```

### 8.2. Giới hạn wrap chữ
Nếu text bị dài:
- giảm `langs_count`
- giảm số `badges`
- rút ngắn `desc`
- rút ngắn `points`

### 8.3. Thêm/bớt thông tin trên pin-card
Thông thường pin-card có `--show` / `--hide` (tuỳ repo).

---

## 9. Troubleshooting

### 9.1. Lỗi `--out: command not found` (Actions)
Nguyên nhân: YAML xuống dòng sai, `--out` bị hiểu là command mới.

✅ Cách đúng:
- Dùng `run: >-` như ví dụ ở trên, hoặc
- Dùng `run: |` + backslash `\` và đảm bảo `\` là ký tự **cuối dòng** (không có dấu cách sau nó).

### 9.2. SVG bị tràn / bị cắt
- Nếu **bị tràn ngang**: thường do tính width cột sai → cần trừ padding 2 bên.
- Nếu **bị cắt dưới**: cần tăng chiều cao card theo nội dung (CTA / bullets).
- Với hero: stats phải bắt đầu **sau** header cột phải (tránh đè chữ).

### 9.3. Bị rate limit GitHub API
- Dùng token (`GITHUB_TOKEN` hoặc PAT)
- Giảm `max_repos`
- Giảm tần suất cron

---

## 10. FAQ

**Q: Có cần commit `generated/` không?**  
A: Nên commit để README load nhanh và ổn định.

**Q: Mình muốn 2 ảnh cùng hàng?**  
A: Dùng HTML `<img ... height="...">` để cân.

---

## 11. License

Xem file `LICENSE` trong repo.
