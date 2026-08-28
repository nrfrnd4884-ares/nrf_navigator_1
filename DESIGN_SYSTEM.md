# 국가연구개발성과 도우미 디자인 시스템

현재 화면의 시각 언어를 기준으로 한 공통 디자인 규칙입니다. 새 화면이나 컴포넌트는 기존 화면의 값을 복사하기보다 아래 토큰과 패턴을 우선 사용합니다.

## 1. 디자인 방향

- KRDS(대한민국 정부 디자인시스템) 참고 목업(`krds_question_board.html`)의 시각 언어를 기준으로 함
- 흰색 카드와 옅은 회색 배경(`#f5f7fa`, 장식 없는 단색)을 사용한 정보 중심 레이아웃
- 주요 행동은 KRDS 블루(`#2563eb`), 특허 등 보조 구분은 teal, 성공은 green, 확인 필요 안내는 amber, 오류는 red로 구분
- 한 화면 안에서 카드·입력창·버튼의 높이와 간격을 일정하게 유지

## 2. 색상 토큰

CSS 토큰은 `css/base.css`의 `:root`에 정의되어 있습니다. 새 코드에서는 의미 기반 별칭을 사용합니다.

| 용도 | 토큰 | 값 |
| --- | --- | --- |
| 화면 배경 | `--color-background` (`--bg`) | `#f5f7fa` |
| 카드/입력 배경 | `--color-surface` (`--surface`) | `#fff` |
| 보조 배경 | `--color-surface-muted` (`--surface2`) | `#f3f4f6` |
| 기본 텍스트 | `--color-text-primary` (`--tp`) | `#1f2937` |
| 보조 텍스트 | `--color-text-secondary` (`--ts`) | `#4b5563` |
| 비활성/힌트 텍스트 | `--color-text-muted` (`--tm`) | `#6b7280` |
| 브랜드/주요 버튼 | `--color-brand` (`--accent`) | `#2563eb` |
| 브랜드 선택 배경 | `--color-brand-soft` (`--accent-l`) | `#eff6ff` |
| 강조 네이비(헤더·topbar·페이지 제목) | `--color-navy` (`--navy`) | `#172554` |
| 일반 테두리 | `--color-border` (`--border`) | `#e5e7eb` |
| 강조 테두리 | `--color-border-strong` (`--border2`) | `#d1d5db` |
| 성공 상태 | `--color-success`, `--color-success-soft` | `#047857` / `#ecfdf5` |
| 오류 상태 | `--color-danger`, `--color-danger-soft` | `#b91c1c` / `#fef2f2` |
| 확인 필요(주의, 오류 아님) | `--warning` | `#b45309` (박스는 `--warn-bg`/`--warn-border`) |
| 특허 등 2차 구분색 | `--teal` | `#0f766e` |

## 3. 간격과 형태

- 기본 간격: `--space-1`(4px), `--space-2`(8px), `--space-3`(12px), `--space-4`(16px), `--space-5`(20px), `--space-6`(24px), `--space-7`(32px)
- 작은 모서리: `--radius-sm`(`--r2`, 6px)
- 카드 모서리: `--radius-md`(`--r`, 8px)
- 기본 입력/버튼 높이: `--control-height`(44px)
- 카드 그림자: `--shadow-card`(`--sh`) — `0 2px 8px rgba(15,23,42,.06), 0 0 0 1px rgba(15,23,42,.04)`
- 키보드 포커스: 박스섀도 링은 `--focus`, 아웃라인은 `--focus-outline`(`#93c5fd`, `outline:3px solid`)
- 배경 장식(그라데이션·사선 무늬)은 쓰지 않습니다. 단색 배경 위에 카드 대비로 위계를 만듭니다.

## 4. 타이포그래피

- 기본 글꼴: Pretendard, 시스템 한글 폴백
- 본문: 17px / 1.6 (KRDS 권장 기준. 2026-08에 기존 14px에서 17/14 비율로 전체 상향)
- 보조 설명: 15–16px
- 카드 제목: 19px / 1.6 / 600
- 섹션 라벨: 15–16px / 600
- DOI·번호·코드: `IBM Plex Mono`
- 새 폰트 크기를 추가할 때도 이 비율(× 17/14 ≈ 1.21, 정수로 반올림)을 기준으로 삼습니다.

## 5. 컴포넌트 패턴

### 카드

`.search-card`, `.result-card`, `.patent-card`, `.check-card`를 기준으로 합니다. 카드에는 `var(--color-surface)`, `var(--color-border)`, `var(--radius-md)`, `var(--shadow-card)`를 사용합니다.

### 탭

`.search-tabs` 안에 `.stab`을 배치합니다. 활성 탭은 `.stab.active`로 표현하며 브랜드 색상과 하단 2px 선을 사용합니다. 탭 패널의 초기 표시 상태는 HTML의 숨김 클래스가 아니라 JavaScript의 `switchSearch()` 또는 `switchPatentSearch()`가 관리합니다.

새 탭 그룹을 만들 때는 KRDS 탭 패턴을 그대로 따릅니다: `.search-tabs`에 `role="tablist"`와 `aria-label`, 각 `.stab`에 `role="tab"` · `aria-selected` · `aria-controls="{패널 id}"`, 각 패널에 `role="tabpanel"` · `aria-labelledby="{탭 id}"`를 붙입니다. 탭 전환 함수(`switchSearch`/`switchPatentSearch`)는 `active` 클래스와 함께 `aria-selected`도 반드시 갱신합니다.

### 입력과 버튼

`.input-row` 안에 `.s-input`과 `.s-btn`을 배치합니다. 입력과 버튼은 44px 높이를 기본으로 하며, 모바일에서는 기존 반응형 규칙에 따라 세로로 쌓습니다.

### 결과 상세

논문은 `.result-card`/`.rc-*`, 특허는 `.patent-card`/`.patent-*` 전용 구조를 유지합니다. 공통 토큰과 제목 패딩만 공유하고, 데이터 필드와 상세 결과 구조는 도메인별로 분리합니다.

### 상단 유틸리티 바 / Breadcrumb / Page-head

- `.topbar`: 헤더 위 네이비 바(연락처 등 유틸리티 정보). `pages/header.html`에 정적으로 포함되어 있습니다.
- `.breadcrumb`: 홈이 아닌 모든 패널의 제목 블록 위에 `홈 › {상위그룹} › {현재 페이지}` 형태로 둡니다. 첫 항목("홈")은 `resetHome(event)`를 호출하는 실제 버튼입니다.
- `.page-head`: 제목(`.pg-title`)+설명(`.pg-desc`)을 감싼 `<div>` 하나와, 있다면 우측 액션 버튼을 형제로 둡니다. 하단 네이비 밑줄이 특징입니다. **주의**: `.page-head`는 `display:flex`이므로 제목+설명은 반드시 별도 `<div>`로 한 번 더 감싸야 나란히 배치되지 않습니다.

### 버튼 / 모달

- 범용 보조 버튼은 `.btn`(필요 시 `.btn.primary`)을 씁니다. 입력창에 붙는 검색 버튼(`.s-btn`)은 예외로 그대로 둡니다.
- 새 모달은 커스텀 오버레이 `<div>` 대신 네이티브 `<dialog>`를 사용합니다(`#write-modal` 참고). 열기/닫기는 `showModal()`/`close()`로 하고, 백드롭 클릭 닫기는 `dialog.addEventListener('click', e => { if (e.target === dialog) ... })` 패턴을 따르며, 입력값 초기화 등 정리 로직은 여러 닫기 경로(버튼·Esc·백드롭)가 모두 거치는 `close` 이벤트 리스너 한 곳에 모아둡니다.

## 6. 상태와 접근성

- `:focus` 상태를 제거하지 말고 `--focus`를 사용합니다.
- 비활성 버튼은 색상과 커서로 상태를 함께 전달합니다.
- 오류·성공 상태는 색상만으로 구분하지 않고 아이콘 또는 안내 문구를 함께 표시합니다.
- 모바일 폭에서는 2열 정보 그리드를 1열로 전환합니다.
- 검색/입력 필드는 보이는 레이블이 없다면 `<label class="sr-only" for="...">`을 반드시 짝지어 둡니다.
- 검색 결과·목록·채팅 로그처럼 비동기로 채워지는 컨테이너에는 `aria-live="polite"`(대화 로그는 `role="log"`)를 붙여 스크린리더가 갱신을 인지하게 합니다. 컨테이너 자체를 교체(outerHTML)하지 말고 내용만(innerHTML) 갱신해야 속성이 유지됩니다.
- 아이콘만 있는 버튼(닫기 `×` 등)에는 `aria-label`을 붙입니다. 순수 장식용 SVG는 `aria-hidden="true"`로 감춥니다.
- 열고 닫는 토글 버튼(드롭다운 등)에는 `aria-expanded`를 상태에 맞춰 갱신합니다.
- 현재 위치를 나타내는 nav/사이드바 버튼에는 `aria-current="page"`를 함께 설정합니다(`switchPanel()`이 자동 처리).
- `--tm`(옅은 회색, 흰 배경 대비 ≈4.8:1)은 WCAG AA를 만족하도록 맞춰져 있습니다. 새 토큰을 추가할 때도 본문/라벨 텍스트는 흰 배경 기준 4.5:1 이상을 유지합니다.

## 7. 파일 책임

- `css/base.css`: 리셋, 전역 토큰, 기본 문서 스타일
- `css/layout.css`: 헤더·메인·패널 레이아웃
- `css/search.css`: 논문 검색과 공통 검색 결과
- `css/components.css`: 공통 UI 및 특허 상세 컴포넌트
- `css/html-classes.css`: 기존 HTML 인라인 스타일의 호환 클래스
- `pages/*.html`: 화면 구조
- `js/navigation.js`: 패널·검색 탭 전환
- `js/papers.js`, `js/patents.js`: 도메인별 검색과 결과 렌더링
