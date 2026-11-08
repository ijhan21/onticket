-- ==============================================================================
-- 온티켓 (OnTicket) 초기 데이터베이스 스키마 마이그레이션
-- 근거: docs/ERD.md (버전 1.0, 확정)
-- 대상 테이블: events, ticket_types, users, orders, checkins
-- ==============================================================================

-- 1. 공연 (events)
CREATE TABLE IF NOT EXISTS events (
    event_id VARCHAR(30) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    venue VARCHAR(200) NOT NULL,
    city VARCHAR(50) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    sales_status VARCHAR(20) NOT NULL DEFAULT '판매중',
    organizer VARCHAR(100) NOT NULL DEFAULT '(주)승승장구',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_events_sales_status CHECK (sales_status IN ('판매중', '매진', '판매종료'))
);

-- 2. 티켓 등급 (ticket_types)
-- 주의: 파생값인 잔여수량(remaining_quantity)은 저장하지 않음 (total_quantity - sold_quantity로 계산)
CREATE TABLE IF NOT EXISTS ticket_types (
    ticket_type_id VARCHAR(30) PRIMARY KEY,
    event_id VARCHAR(30) NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
    grade VARCHAR(50) NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    sold_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ticket_types_price CHECK (price >= 0),
    CONSTRAINT chk_ticket_types_quantity CHECK (total_quantity >= 0 AND sold_quantity >= 0),
    -- 초과 판매 방지 DB 강제 제약조건 (코드가 뚫려도 DB가 거부)
    CONSTRAINT chk_ticket_types_sold_limit CHECK (sold_quantity <= total_quantity)
);

-- 3. 회원 (users) - 과거 데이터 보관 및 참조용
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 주문 (orders)
-- 비회원 예매이므로 purchaser_email이 필수(NOT NULL) 식별자
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(30) PRIMARY KEY,
    user_id VARCHAR(30) REFERENCES users(user_id) ON DELETE SET NULL,
    event_id VARCHAR(30) NOT NULL REFERENCES events(event_id) ON DELETE RESTRICT,
    ticket_type_id VARCHAR(30) NOT NULL REFERENCES ticket_types(ticket_type_id) ON DELETE RESTRICT,
    purchaser_email VARCHAR(255) NOT NULL,
    purchaser_name VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 1,
    total_amount INTEGER NOT NULL DEFAULT 0,
    payment_method VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT '결제대기',
    ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    qr_code VARCHAR(50) UNIQUE,
    payment_key VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_orders_quantity_range CHECK (quantity >= 1 AND quantity <= 4),
    CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0),
    CONSTRAINT chk_orders_status CHECK (status IN ('결제대기', '결제완료', '입장완료', '취소', '환불', '실패'))
);

-- 5. 입장 확인 기록 (checkins)
CREATE TABLE IF NOT EXISTS checkins (
    checkin_id VARCHAR(30) PRIMARY KEY,
    order_id VARCHAR(30) NOT NULL REFERENCES orders(order_id) ON DELETE RESTRICT,
    qr_code VARCHAR(50) NOT NULL,
    gate VARCHAR(50) NOT NULL,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result VARCHAR(20) NOT NULL DEFAULT '정상',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_checkins_result CHECK (result IN ('정상'))
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_id ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_purchaser_email ON orders(purchaser_email);
CREATE INDEX IF NOT EXISTS idx_orders_qr_code ON orders(qr_code);
CREATE INDEX IF NOT EXISTS idx_checkins_order_id ON checkins(order_id);
CREATE INDEX IF NOT EXISTS idx_checkins_qr_code ON checkins(qr_code);

-- RLS (Row Level Security) 활성화
-- 외부(브라우저 anon 키)의 직접 접근을 차단하고, Supabase 대시보드 경고를 해제합니다.
-- 백엔드 API 서버는 postgres 마스터 계정을 사용하므로 RLS를 안전하게 바이패스합니다.
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
