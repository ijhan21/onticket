# 온티켓 API 명세

- 버전: 1.0
- 상태: 확정
- 작성일: 2026-11-07
- 근거: `docs/PRD.md` (버전 1.1, 확정), `docs/화면기획서.md` (버전 1.0, 확정), `docs/ERD.md` (버전 1.0, 확정)

| 버전 | 날짜 | 바꾼 것 | 결정자 |
|---|---|---|---|
| 0.1 | 2026-11-07 | 초안 작성: 고객 및 운영 9개 엔드포인트 도출, 세 방향 대조(PRD·화면기획서·ERD) 반영 | 아키텍트 |
| 1.0 | 2026-11-07 | 명세 검토 완료에 따른 확정: 5절 미결 사항 아키텍트 결정 반영, 9개 엔드포인트 확정 | 사용자(검토), 아키텍트 |

---

## 0. 공통 규칙

- 기본 주소: `http://localhost:8787` (로컬 개발 환경, 배포 시 Cloudflare Workers 도메인 적용)
- 형식: 요청 및 응답 본문은 `application/json` (UTF-8). 날짜 및 시각은 ISO 8601 문자열(`YYYY-MM-DDTHH:mm:ssZ`). 금액 및 수량은 원 단위 정수(`number`).
- 오류 응답: error 객체에 code(대문자 스네이크 문자열), message(친절한 한 문장)를 담은 JSON 반환 (구조: error.code="ERROR_CODE", error.message="사람이 읽는 친절한 안내 문장")
- 상태코드:
  - `200 OK`: 조회 및 수정 성공
  - `201 Created`: 자원 생성 성공 (주문 생성, 결제 승인, 등록 등)
  - `400 Bad Request`: 필수값 누락, 형식 오류, 수량 범위 밖(1~4 초과)
  - `401 Unauthorized`: 운영팀 비밀번호 누락 또는 불일치
  - `404 Not Found`: 대상 공연, 등급, 티켓/주문이 존재하지 않음
  - `409 Conflict`: 리소스 상태 충돌 (매진, 잔여석 부족, 이미 입장 완료된 티켓, 이미 결제된 주문 등)
  - `500 Internal Server Error`: 서버 내부 처리 예외
- 운영팀 인증: 운영자 전용 엔드포인트(`/admin/*`)는 HTTP 요청 헤더에 `X-Admin-Password: admin_password`를 필수로 전달해야 하며, 불일치 시 `401 Unauthorized`를 반환한다.
- 상태값 규칙: 모든 상태값(`sales_status`, `status`, `result`)은 `docs/ERD.md`의 한국어 문자열(`판매중`, `매진`, `결제대기`, `결제완료`, `입장완료`, `실패`, `정상` 등)을 글자 그대로 사용한다.
- 계산값 원칙: 잔여 수량, 결제 금액, 총 입금액 등 모든 계산값은 반드시 서버가 계산하며 클라이언트의 계산값을 신뢰하지 않는다.

---

## 1. 엔드포인트 목록

| 메서드 | 경로 | 하는 일 | 근거(PRD R) | 쓰는 화면 |
|---|---|---|---|---|
| GET | /events | 판매 가능한 공연 목록 조회 | R1, R24 | S01 공연 목록 |
| GET | /events/:event_id | 공연 상세 정보 및 등급별 잔여석 조회 | R1, R5, R6 | S02 공연 상세·예매 |
| POST | /orders | 비회원 주문 생성 (결제대기 상태) | R1, R6, R20, R22 | S02 공연 상세·예매 |
| POST | /orders/:order_id/payment | 결제 승인 처리 및 QR 코드 발급 | R1, R7, R8, R22 | S03 결제 완료, S04 결제 실패 |
| GET | /orders | 주문번호와 이메일로 비회원 티켓 조회 | R7, R21, R22 | S05 티켓 조회 |
| GET | /admin/events | 운영팀 전체 공연 목록 및 판매·입금 현황 조회 | R11, R23, R24 | S07 공연 현황 |
| POST | /admin/events | 운영팀 신규 공연 및 등급 등록 | R5, R23, R24 | S08 공연 등록·수정 |
| PUT | /admin/events/:event_id | 운영팀 공연 정보 및 등급 수정 | R5, R23, R24 | S08 공연 등록·수정 |
| POST | /admin/checkins | 현장 게이트 QR 스캔 입장 확인 및 기록 | R9, R23 | S09 입장 확인 |

---

## 2. 엔드포인트별 명세

### GET /events — 판매 가능한 공연 목록 조회

판매상태가 `판매중` 또는 `매진`인 공연 목록을 시작일시 빠른 순으로 조회한다 (`판매종료` 제외).

요청:

| 위치 | 이름 | 자료형 | 필수 | 조건 | ERD 컬럼 |
|---|---|---|---|---|---|
| 쿼리 | 없음 | string | 선택 | - | `events.sales_status` |

응답 200:

| 이름 | 자료형 | 출처 |
|---|---|---|
| events | array | `events` 테이블 목록 |
| events[].event_id | string | `events.event_id` |
| events[].title | string | `events.title` |
| events[].category | string | `events.category` |
| events[].venue | string | `events.venue` |
| events[].city | string | `events.city` |
| events[].start_at | string | `events.start_at` |
| events[].end_at | string | `events.end_at` |
| events[].sales_status | string | `events.sales_status` |

오류:

| 상태코드 | code | 언제 |
|---|---|---|
| 500 | INTERNAL_SERVER_ERROR | 서버 내부 오류 발생 시 |

---

### GET /events/:event_id — 공연 상세 정보 및 등급별 잔여석 조회

특정 공연의 기본 정보와 해당 공연에 등록된 모든 티켓 등급 및 실시간 잔여석을 조회한다.

요청:

| 위치 | 이름 | 자료형 | 필수 | 조건 | ERD 컬럼 |
|---|---|---|---|---|---|
| 경로 | event_id | string | 필수 | 공연 식별자 (예: 'EV001') | `events.event_id` |

응답 200:

| 이름 | 자료형 | 출처 |
|---|---|---|
| event_id | string | `events.event_id` |
| title | string | `events.title` |
| category | string | `events.category` |
| venue | string | `events.venue` |
| city | string | `events.city` |
| start_at | string | `events.start_at` |
| end_at | string | `events.end_at` |
| sales_status | string | `events.sales_status` |
| organizer | string | `events.organizer` |
| ticket_types | array | `ticket_types` 목록 |
| ticket_types[].ticket_type_id | string | `ticket_types.ticket_type_id` |
| ticket_types[].grade | string | `ticket_types.grade` |
| ticket_types[].price | number | `ticket_types.price` |
| ticket_types[].total_quantity | number | `ticket_types.total_quantity` |
| ticket_types[].sold_quantity | number | `ticket_types.sold_quantity` |
| ticket_types[].remaining_quantity | number | 계산식: `ticket_types.total_quantity - ticket_types.sold_quantity` |

오류:

| 상태코드 | code | 언제 |
|---|---|---|
| 404 | EVENT_NOT_FOUND | 요청한 공연 ID가 존재하지 않을 때 |

---

### POST /orders — 비회원 주문 생성 (결제대기 상태)

고객이 선택한 등급, 수량, 구매자 이메일을 받아 주문을 생성하고 `결제대기` 상태로 대기한다. 서버가 결제금액을 직접 계산한다.

요청:

| 위치 | 이름 | 자료형 | 필수 | 조건 | ERD 컬럼 |
|---|---|---|---|---|---|
| 본문 | event_id | string | 필수 | 공연 식별자 | `orders.event_id` |
| 본문 | ticket_type_id | string | 필수 | 티켓 등급 식별자 | `orders.ticket_type_id` |
| 본문 | purchaser_email | string | 필수 | 유효한 이메일 형식 | `orders.purchaser_email` |
| 본문 | purchaser_name | string | 선택 | 구매자 성명 | `orders.purchaser_name` |
| 본문 | quantity | number | 필수 | 정수, 1~4매 (R1, AC2) | `orders.quantity` |

응답 201:

| 이름 | 자료형 | 출처 |
|---|---|---|
| order_id | string | `orders.order_id` (예: 'ORD-YYYYMMDD-####') |
| event_id | string | `orders.event_id` |
| ticket_type_id | string | `orders.ticket_type_id` |
| purchaser_email | string | `orders.purchaser_email` |
| quantity | number | `orders.quantity` |
| total_amount | number | 계산식: `ticket_types.price * orders.quantity` |
| status | string | `orders.status` ('결제대기') |
| ordered_at | string | `orders.ordered_at` |

오류:

| 상태코드 | code | 언제 |
|---|---|---|
| 400 | INVALID_INPUT | 필수 입력 누락, 이메일 형식 오류, 수량이 1~4 범위를 벗어날 때 |
| 404 | NOT_FOUND | 존재하지 않는 공연이거나 해당 공연의 등급이 아닐 때 |
| 409 | SOLD_OUT | 해당 등급 또는 공연이 매진되었거나, 요청 수량보다 잔여석이 부족할 때 |

---

### POST /orders/:order_id/payment — 결제 승인 처리 및 QR 코드 발급

결제대행사 결제창에서 결제 완료 후 반환된 정보로 서버 승인을 요청한다. 승인 성공 시 `결제완료` 상태로 변경되고 고유 QR 코드가 발급된다.

요청:

| 위치 | 이름 | 자료형 | 필수 | 조건 | ERD 컬럼 |
|---|---|---|---|---|---|
| 경로 | order_id | string | 필수 | 주문 식별자 | `orders.order_id` |
| 본문 | payment_key | string | 필수 | 결제대행사 승인 키 식별자 | `orders.payment_key` |
| 본문 | payment_method | string | 필수 | 카드, 토스페이, 카카오페이 등 | `orders.payment_method` |
| 본문 | total_amount | number | 필수 | 결제된 금액 (주문 금액과 검증) | `orders.total_amount` |

응답 200:

| 이름 | 자료형 | 출처 |
|---|---|---|
| order_id | string | `orders.order_id` |
| status | string | `orders.status` ('결제완료') |
| qr_code | string | `orders.qr_code` (형식: 'OT-####-XXXX') |
| payment_method | string | `orders.payment_method` |
| total_amount | number | `orders.total_amount` |

오류:

| 상태코드 | code | 언제 |
|---|---|---|
| 400 | AMOUNT_MISMATCH | 요청된 결제 금액이 생성된 주문의 `total_amount`와 일치하지 않을 때 |
| 404 | ORDER_NOT_FOUND | 해당 `order_id`의 주문을 찾을 수 없을 때 |
| 409 | ALREADY_PROCESSED | 이미 결제완료, 취소, 환불 등 완료 처리된 주문일 때 |
| 400 | PAYMENT_FAILED | 결제대행사 승인 실패 또는 한도 초과 등으로 결제 승인이 거부되었을 때 |

---

### GET /orders — 주문번호와 이메일로 비회원 티켓 조회

로그인이 없는 1차 온티켓에서 주문번호와 구매자 이메일 2가지를 모두 검증하여 해당 티켓의 QR 코드 및 예매 내역을 조회한다.

요청:

| 위치 | 이름 | 자료형 | 필수 | 조건 | ERD 컬럼 |
|---|---|---|---|---|---|
| 쿼리 | order_id | string | 필수 | 주문 식별자 | `orders.order_id` |
| 쿼리 | purchaser_email | string | 필수 | 예매 시 입력한 구매자 이메일 | `orders.purchaser_email` |

응답 200:

| 이름 | 자료형 | 출처 |
|---|---|---|
| order_id | string | `orders.order_id` |
| event_title | string | `events.title` |
| venue | string | `events.venue` |
| start_at | string | `events.start_at` |
| grade | string | `ticket_types.grade` |
| quantity | number | `orders.quantity` |
| total_amount | number | `orders.total_amount` |
| status | string | `orders.status` |
| qr_code | string | `orders.qr_code` |

오류:

| 상태코드 | code | 언제 |
|---|---|---|
| 400 | MISSING_PARAMETERS | `order_id` 또는 `purchaser_email` 쿼리 파라미터가 누락되었을 때 |
| 404 | TICKET_NOT_FOUND | 주문번호가 없거나, 주문번호는 맞으나 이메일이 일치하지 않을 때 |

---

### GET /admin/events — 운영팀 전체 공연 목록 및 판매·입금 현황 조회

운영팀이 전체 공연의 판매 상태, 등급별 판매 수량, 공연별 총 입금액을 조회한다.

요청:

| 위치 | 이름 | 자료형 | 필수 | 조건 | ERD 컬럼 |
|---|---|---|---|---|---|
| 머리 | X-Admin-Password | string | 필수 | 운영팀 공유 비밀번호 | 없음(계산 및 인증) |

응답 200:

| 이름 | 자료형 | 출처 |
|---|---|---|
| events | array | 전체 공연 목록 |
| events[].event_id | string | `events.event_id` |
| events[].title | string | `events.title` |
| events[].sales_status | string | `events.sales_status` |
| events[].start_at | string | `events.start_at` |
| events[].end_at | string | `events.end_at` |
| events[].sold_quantity | number | 계산식: 해당 공연 등급별 `ticket_types.sold_quantity` 합계 |
| events[].total_revenue | number | 계산식: 해당 공연의 `결제완료`·`입장완료` 주문 `orders.total_amount` 합계 |

오류:

| 상태코드 | code | 언제 |
|---|---|---|
| 401 | UNAUTHORIZED | `X-Admin-Password` 헤더가 없거나 비밀번호가 틀렸을 때 |

---

### POST /admin/events — 운영팀 신규 공연 및 등급 등록

운영팀이 신규 공연 정보와 1~4개의 티켓 등급을 등록한다.

요청:

| 위치 | 이름 | 자료형 | 필수 | 조건 | ERD 컬럼 |
|---|---|---|---|---|---|
| 머리 | X-Admin-Password | string | 필수 | 운영팀 공유 비밀번호 | 없음(계산 및 인증) |
| 본문 | event_id | string | 필수 | 신규 공연 식별자 (예: 'EV008') | `events.event_id` |
| 본문 | title | string | 필수 | 공연 제목 | `events.title` |
| 본문 | category | string | 필수 | 콘서트, 뮤지컬, 세미나 등 | `events.category` |
| 본문 | venue | string | 필수 | 공연 장소 | `events.venue` |
| 본문 | city | string | 필수 | 공연 도시 | `events.city` |
| 본문 | start_at | string | 필수 | 시작 일시 | `events.start_at` |
| 본문 | end_at | string | 필수 | 종료 일시 | `events.end_at` |
| 본문 | sales_status | string | 필수 | '판매중', '매진', '판매종료' | `events.sales_status` |
| 본문 | ticket_types | array | 필수 | 1~4개 등급 목록 | `ticket_types` |
| 본문 | ticket_types[].ticket_type_id | string | 필수 | 등급 식별자 | `ticket_types.ticket_type_id` |
| 본문 | ticket_types[].grade | string | 필수 | 등급명 (VIP 등) | `ticket_types.grade` |
| 본문 | ticket_types[].price | number | 필수 | 0 이상 정수 | `ticket_types.price` |
| 본문 | ticket_types[].total_quantity | number | 필수 | 0 이상 정수 | `ticket_types.total_quantity` |

응답 201:

| 이름 | 자료형 | 출처 |
|---|---|---|
| event_id | string | `events.event_id` |
| title | string | `events.title` |
| sales_status | string | `events.sales_status` |
| ticket_types | array | 생성된 `ticket_types` 목록 |

오류:

| 상태코드 | code | 언제 |
|---|---|---|
| 401 | UNAUTHORIZED | 운영팀 비밀번호가 누락되거나 틀렸을 때 |
| 400 | INVALID_EVENT_DATA | 필수값 누락, 등급 수가 1~4 범위를 벗어날 때 |
| 409 | DUPLICATE_EVENT_ID | 이미 존재하는 `event_id`일 때 |

---

### PUT /admin/events/:event_id — 운영팀 공연 정보 및 등급 수정

운영팀이 기존 공연 정보와 등급 목록을 수정한다. 총수량은 기판매된 `sold_quantity`보다 작게 수정할 수 없다 (R24, AC44).

요청:

| 위치 | 이름 | 자료형 | 필수 | 조건 | ERD 컬럼 |
|---|---|---|---|---|---|
| 머리 | X-Admin-Password | string | 필수 | 운영팀 공유 비밀번호 | 없음(계산 및 인증) |
| 경로 | event_id | string | 필수 | 공연 식별자 | `events.event_id` |
| 본문 | title | string | 필수 | 공연 제목 | `events.title` |
| 본문 | category | string | 필수 | 카테고리 | `events.category` |
| 본문 | venue | string | 필수 | 장소 | `events.venue` |
| 본문 | city | string | 필수 | 도시 | `events.city` |
| 본문 | start_at | string | 필수 | 시작 일시 | `events.start_at` |
| 본문 | end_at | string | 필수 | 종료 일시 | `events.end_at` |
| 본문 | sales_status | string | 필수 | '판매중', '매진', '판매종료' | `events.sales_status` |
| 본문 | ticket_types | array | 필수 | 등급 목록 | `ticket_types` |
| 본문 | ticket_types[].ticket_type_id | string | 필수 | 등급 식별자 | `ticket_types.ticket_type_id` |
| 본문 | ticket_types[].grade | string | 필수 | 등급명 | `ticket_types.grade` |
| 본문 | ticket_types[].price | number | 필수 | 가격 | `ticket_types.price` |
| 본문 | ticket_types[].total_quantity | number | 필수 | 총수량 | `ticket_types.total_quantity` |

응답 200:

| 이름 | 자료형 | 출처 |
|---|---|---|
| event_id | string | `events.event_id` |
| title | string | `events.title` |
| sales_status | string | `events.sales_status` |

오류:

| 상태코드 | code | 언제 |
|---|---|---|
| 401 | UNAUTHORIZED | 운영팀 비밀번호가 틀렸을 때 |
| 404 | EVENT_NOT_FOUND | 수정 대상 공연이 존재하지 않을 때 |
| 400 | TOTAL_LESS_THAN_SOLD | `total_quantity`를 이미 팔린 `sold_quantity`보다 작게 줄이려 할 때 (AC44) |

---

### POST /admin/checkins — 현장 게이트 QR 스캔 입장 확인 및 기록

공연장 현장 게이트에서 스캔된 QR 코드를 검증하여 정상 입장을 처리하고 `checkins` 이력을 기록한다.

요청:

| 위치 | 이름 | 자료형 | 필수 | 조건 | ERD 컬럼 |
|---|---|---|---|---|---|
| 머리 | X-Admin-Password | string | 필수 | 운영팀 공유 비밀번호 | 없음(계산 및 인증) |
| 본문 | qr_code | string | 필수 | 스캔된 QR 코드 문자열 | `checkins.qr_code` |
| 본문 | gate | string | 필수 | A게이트, B게이트 등 | `checkins.gate` |

응답 201:

| 이름 | 자료형 | 출처 |
|---|---|---|
| checkin_id | string | `checkins.checkin_id` (예: 'CHK0016') |
| order_id | string | `checkins.order_id` |
| qr_code | string | `checkins.qr_code` |
| gate | string | `checkins.gate` |
| checked_in_at | string | `checkins.checked_in_at` |
| result | string | `checkins.result` ('정상') |

오류:

| 상태코드 | code | 언제 |
|---|---|---|
| 401 | UNAUTHORIZED | 운영팀 비밀번호가 틀렸을 때 |
| 404 | INVALID_QR_CODE | 시스템에 존재하지 않는 QR 코드일 때 |
| 409 | ALREADY_CHECKED_IN | 이미 입장 처리가 완료된 티켓일 때 (중복 입장 차단, AC30) |
| 409 | INVALID_ORDER_STATUS | 결제완료 상태가 아닌 주문(취소, 환불 등)의 QR 코드일 때 (AC20) |

---

## 3. 화면별 값 대조표

| 화면 | 화면이 보여 주는 값 | 어느 응답의 어느 필드 |
|---|---|---|
| S01 공연 목록 | 공연 제목, 카테고리, 시작일시, 장소, 도시 | GET /events → events[].title, category, start_at, venue, city |
| S01 공연 목록 | 매진 표시 | GET /events → events[].sales_status = '매진' |
| S02 공연 상세·예매 | 공연 상세 정보 (제목, 카테고리, 일시, 장소) | GET /events/:event_id → title, category, start_at, end_at, venue, city |
| S02 공연 상세·예매 | 등급 목록 (등급명, 가격) | GET /events/:event_id → ticket_types[].grade, price |
| S02 공연 상세·예매 | 남은 수량 | GET /events/:event_id → ticket_types[].remaining_quantity |
| S02 공연 상세·예매 | 선택 수량에 따른 결제 금액 | POST /orders → total_amount |
| S03 결제 완료 | 주문번호, 수량, 결제금액, 주문상태 | POST /orders/:order_id/payment → order_id, total_amount, status |
| S03 결제 완료 | QR 티켓 표시 | POST /orders/:order_id/payment → qr_code |
| S04 결제 실패 | 결제 실패 안내 문구 및 재시도 | POST /orders/:order_id/payment → 오류 응답 error.message |
| S05 티켓 조회 | 주문번호 및 이메일 입력값 검증 후 QR 티켓 노출 | GET /orders → qr_code, event_title, grade, quantity, total_amount, status |
| S06 운영 비밀번호 확인 | 비밀번호 입력 검증 | GET /admin/events → X-Admin-Password 헤더 검증 성공 시 진입 |
| S07 공연 현황 | 공연 목록, 판매상태, 판매수량 합계 | GET /admin/events → events[].title, sales_status, sold_quantity |
| S07 공연 현황 | 공연별 총 입금액 | GET /admin/events → events[].total_revenue |
| S08 공연 등록·수정 | 등록/수정할 공연 및 등급 정보 입력 | POST /admin/events, PUT /admin/events/:event_id |
| S09 입장 확인 | 스캔된 QR 코드의 입장 판정 결과, 게이트, 일시 | POST /admin/checkins → result, gate, checked_in_at |

---

## 4. 계산값

| 이름 | 계산식 | 계산하는 곳 |
|---|---|---|
| remaining_quantity | total_quantity - sold_quantity | 서버 |
| total_amount | price * quantity | 서버 |
| total_revenue | SUM(orders.total_amount) WHERE status IN ('결제완료', '입장완료') | 서버 |

---

## 5. 질문

| ID | 질문 및 결정 사항 | 결정 내용 및 의견 | 결정자 |
|---|---|---|---|
| Q1 | 결제 승인 API 선반영 여부 | 1차 출시는 모의 결제로 진행되더라도 명세에는 PG사 연동 규격(`POST /orders/:order_id/payment`)을 온전히 반영하여 클라이언트 코드 수정 없이 백엔드만 교체 가능하도록 확정함 | 아키텍트 |
| Q2 | 잔여 수량 및 금액 계산 주체 | "클라이언트를 신뢰하지 마라" 원칙에 따라 잔여석, 금액 등 모든 비즈니스 수치는 100% 서버가 계산하여 응답하고 프론트엔드가 보낸 계산값을 신뢰하지 않음 | 아키텍트 |
| Q3 | 비회원 티켓 조회 보안 수준 | 1차는 회원 로그인이 없으므로 무작위 대입 공격 방지를 위해 `order_id`와 `purchaser_email` 두 가지가 동시에 일치할 때만 티켓/QR 정보를 반환함 | 아키텍트 |

---

## 6. 아키텍트 결정 기록 (Decision Log)

| 번호 | 결정 사항 | 내용 및 근거 |
|---|---|---|
| D-01 | 엔드포인트 리소스 지향 설계 | `GET /getEvents` 같은 동사형 URL을 배제하고 REST 원칙에 따라 `GET /events`, `POST /orders`, `POST /admin/checkins` 등 명사 리소스 기준으로 설계함 |
| D-02 | 빈 목록 응답 형식 | 공연 목록이나 주문 목록이 비어 있을 때 `null`이 아닌 빈 배열 `[]`을 반환하여 프론트엔드의 `map()` 오류를 방지함 |
| D-03 | 금액 및 재고 판정의 서버 독점 | 클라이언트가 수량과 단가를 임의로 계산하여 보내는 것을 불신하고, 서버가 주문 생성 시 직접 `ticket_types.price * quantity`를 계산하여 `total_amount`를 확정함 |
| D-04 | 재고 부족 및 매진 시 상태코드 409 | `400 Bad Request`와 구분하여 재고 선점 경쟁이나 매진으로 인한 리소스 충돌 시 `409 Conflict`(`SOLD_OUT`)를 반환하여 클라이언트가 즉시 매진 상태를 다시 그릴 수 있도록 함 |
| D-05 | 결제 승인 2단계 분리 | 주문 생성(`POST /orders`) 시점에는 `결제대기` 상태로 주문만 잡고, 결제대행사 승인 응답을 검증하는 별도 창구(`POST /orders/:order_id/payment`)를 두어 승인 성공 시에만 QR 코드가 발급되도록 격리함 |
| D-06 | 비회원 티켓 조회 보안 | 타인의 티켓 무단 조회를 방지하기 위해 `GET /orders` 쿼리 파라미터로 `order_id`와 `purchaser_email` 두 가지를 필수로 요구하고 둘 다 일치해야만 티켓 정보를 응답함 |
| D-07 | 운영자 API 경로 및 인증 분리 | 운영자 전용 엔드포인트는 모두 `/admin/` 하위로 격리하고, 요청 헤더 `X-Admin-Password` 검증 실패 시 `401 Unauthorized`로 즉시 차단함 |
| D-08 | 중복 입장 차단 판정 | 현장 QR 확인(`POST /admin/checkins`) 시 이미 `입장완료` 상태인 티켓은 `409 ALREADY_CHECKED_IN`으로 즉시 차단하여 1장으로 다수가 입장하는 부정을 원천 방지함 |
