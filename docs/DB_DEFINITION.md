# 📊 페스티벌 O2O 플랫폼 통합 DB 테이블 정의서 상세 명세 (DB_DEFINITION.md)

> **[필독] AI 에이전트(Antigravity / Cursor / Roo Code) 준수 규칙**
> - 본 문서에 정의된 테이블명 및 컬럼명(Physical) 구조를 100% 엄격하게 준수하여 개발해야 합니다.
> - 초기 빌드 시 물리 외래키(FK) 제약조건은 제거했으나, 자바(JPA) 엔티티 코딩 시에는 연동 로직(@ManyToOne)을 반영해야 합니다.

---

## 📋 테이블명: `app_user`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 유저 고유 식별자 (자동 증가 대형 정수) |
| **email** | `VARCHAR(100)` | N | - | N | - | 로그인용 이메일 (중복 불가) |
| **password** | `VARCHAR(255)` | N | - | N | - | 암호화되어 저장될 비밀번호 |
| **name** | `VARCHAR(50)` | N | - | N | - | 사용자 본명 또는 닉네임 |
| **role** | `VARCHAR(20)` | N | - | N | ROLE_USER | 시스템 권한 (ROLE_USER, ROLE_STAFF, ROLE_ADMIN) |
| **membership_grade** | `VARCHAR(20)` | N | - | N | BRONZE | 멤버십 등급 (BRONZE, SILVER, GOLD, VIP) |
| **balance** | `INT` | N | - | N | 0 | 💸 페스티벌 페이 잔액 (chk_balance_positive 제약조건 적용) |
| **face_vector** | `TEXT` | N | - | Y | - | 👤 안면인식 데이터 고유 벡터값 |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 회원 가입 일시 |

---

## 📋 테이블명: `festival`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 축제 고유 식별자 (event_no 매핑) |
| **name** | `VARCHAR(100)` | N | - | N | - | 축제 명칭 (ex: '2026 워터밤 서울') |
| **start_date** | `DATE` | N | - | N | - | 축제 시작 일자 |
| **end_date** | `DATE` | N | - | N | - | 축제 종료 일자 |
| **is_active** | `BOOLEAN` | N | - | N | False | 현재 앱에서 활성화되어 운영 중인 축제 여부 |
| **map_image_url** | `TEXT` | N | - | Y | - | 축제 행사장 배경 도면 이미지 경로 |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 축제 데이터 등록 일시 |

---

## 📋 테이블명: `festival_zone`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 구역 고유 식별자 (zone_no 매핑) |
| **festival_id** | `BIGINT` | N | festival(id) | N | - | 소속된 축제 ID |
| **zone_name** | `VARCHAR(50)` | N | - | N | - | 구역명 (ex: 'A구역(푸드트럭)', '스탠딩 레드존') |
| **svg_points** | `TEXT` | N | - | N | - | 🗺️ 지도 렌더링용 동적 SVG 상대 좌표값 |
| **safety_limit** | `INT` | N | - | N | 500 | 해당 구역 수용 가능한 최대 안전 수용인원 임계치 |
| **current_crowd_count** | `INT` | N | - | N | 0 | 🚦 실시간 현재 구역 내 체류인원수 |
| **density_level** | `VARCHAR(20)` | N | - | N | 여유 | 실시간 측정 밀집도 레벨 (여유, 보통, 혼잡, 위험) |
| **status** | `VARCHAR(20)` | N | - | N | NORMAL | 관제 시스템용 상태 (NORMAL, CAUTION, DANGER) |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 구역 생성 일시 |

---

## 📋 테이블명: `seat_map`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 좌석 고유 식별자 (seat_no 매핑) |
| **zone_id** | `BIGINT` | N | festival_zone(id) | N | - | 해당 좌석이 위치한 축제 구역 ID |
| **seat_row** | `VARCHAR(10)` | N | - | N | - | 좌석 좌석번호 열/행 정보 (ex: 'A열', 'STANDING') |
| **seat_number** | `INT` | N | - | N | - | 좌석 고유 번호 |
| **price** | `INT` | N | - | N | - | 해당 티켓/좌석의 기본 예매 가격 |
| **status** | `VARCHAR(20)` | N | - | N | 빈자리 | 실시간 좌석 상태 (빈자리, 가선점, 결제완료) |
| **is_reserved** | `BOOLEAN` | N | - | N | FALSE | 💺 좌석 선택 맵에서 선택 불가 시각화 플래그 |
| **version** | `BIGINT` | N | - | N | 0 | JPA 낙관적 락(Optimistic Lock) 버전 번호 |

---

## 📋 테이블명: `store`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 상점/부스 고유 식별자 (store_no 매핑) |
| **zone_id** | `BIGINT` | N | festival_zone(id) | N | - | 부스가 입점해 있는 축제 구역 ID |
| **name** | `VARCHAR(100)` | N | - | N | - | 부스 상호명 (ex: '춘천 닭강정 1호점') |
| **category** | `VARCHAR(20) ` | N | - | N | - | 부스 타입 구분 (FOOD: 먹거리, GOODS: 기획상품) |
| **operating_hours** | `VARCHAR(100)` | N | - | Y | - | 상점별 상세 운영시간 가이드 텍스트 |
| **map_x_percent** | `NUMERIC(5,2)` | N | - | N | - | 📍 반응형 지도 기준 부스 핀 가로 상대 위치 (%) |
| **map_y_percent** | `NUMERIC(5,2)` | N | - | N | - | 📍 반응형 지도 기준 부스 핀 세로 상대 위치 (%) |
| **is_open** | `BOOLEAN` | N | - | N | TRUE | 🚨 어드민 원격 제어용 오픈 플래그 (주문 차단 스위치) |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 부스 입점 등록 일시 |

---

## 📋 테이블명: `product`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 상품 고유 식별자 (product_no 매핑) |
| **store_id** | `BIGINT` | N | store(id) | N | - | 해당 상품을 판매하는 상점/부스 ID |
| **name** | `VARCHAR(100)` | N | - | N | - | 상품명 및 메뉴 마스터 명칭 |
| **price** | `INT` | N | - | N | - | 상품 판매 가격 |
| **image_url** | `TEXT` | N | - | Y | - | 상품 사진 이미지 경로 |
| **total_stock** | `INT` | N | - | N | 0 | 실제 창고에 남아있는 물리적 총 재고량 |
| **reserved_stock** | `INT` | N | - | N | 0 | 결제 진행 중 선점되어 묶인 가선점 재고량 |
| **available_stock** | `INT` | N | - | N | 0 | 실제 유저가 구매 가능한 최종 가용 재고량 |
| **is_soldout** | `BOOLEAN` | N | - | N | FALSE | 사장님 전용 재료소진/품절 수동 마감 버튼 플래그 |
| **status** | `VARCHAR(20)` | N | - | N | ON_SALE | 상품 판매 상태 (ON_SALE, OUT_OF_STOCK) |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 상품 등록 일시 |

---

## 📋 테이블명: `orders`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 전체 주문/예매 고유 번호 (마스터 영수증 ID) |
| **user_id** | `BIGINT` | N | app_user(id) | Y | - | 구매자 ID (탈퇴 시 내역 유지를 위해 SET NULL) |
| **festival_id** | `BIGINT` | N | festival(id) | Y | - | 매출/소비 활동 발생 축제 ID 매핑 |
| **total_price** | `INT` | N | - | N | - | 등급 할인이 적용되기 전 상품 및 티켓의 총 금액 합계 |
| **discount_amount** | `INT` | N | - | N | 0 | 쿠폰 및 등급제로 할인받은 총 혜택 금액 |
| **payment_status** | `VARCHAR(20)` | N | - | N | PAID | 예매/결제 상태 (PENDING, PAID, CANCELLED, REFUNDED) |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 주문 결제 처리 완료 일시 |

---

## 📋 테이블명: `order_item`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 상세 품목 고유 식별자 (item_no 매핑) |
| **order_id** | `BIGINT` | N | orders(id) | N | - | 상위 마스터 주문 영수증 ID |
| **product_id** | `BIGINT` | N | product(id) | Y | - | 구매한 상품 ID (티켓이면 NULL) |
| **seat_id** | `BIGINT` | N | seat_map(id) | Y | - | 예매한 입장권/좌석 ID (상품이면 NULL) |
| **quantity** | `INT` | N | - | N | 1 | 해당 항목 구매 수량 |
| **pickup_time_slot** | `VARCHAR(50)` | N | - | Y | - | ⏱️ 소희님 담당: 퀸즈스마일식 O2O 픽업 예정시간 타임슬롯 |
| **selected_options** | `VARCHAR(255)` | N | - | Y | - | 소희님 담당 상품 선택옵션 (ex: '매운맛/L사이즈') |
| **qr_code_uuid** | `VARCHAR(255)` | N | - | Y | - | 🎫 하율님 담당: 출입 통제 및 픽업 검수용 고유 qr_token |
| **qr_expired_at** | `TIMESTAMP` | N | - | Y | - | 하율님 담당: 일회용 안전 QR 검증 토큰 만료시간 |
| **item_status** | `VARCHAR(20)` | N | - | N | ORDERED | 품목 상태 (ORDERED, PREPARING, READY, PICKED_UP) |
| **updated_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 상태 변경 최신 타임스탬프 |

---

## 📋 테이블명: `scan_log`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 스캔 로그 고유 식별자 (log_no 매핑) |
| **order_item_id** | `BIGINT` | N | order_item(id) | N | - | 스캔된 주문 품목(티켓/푸드 QR) ID |
| **staff_user_id** | `BIGINT` | N | app_user(id) | Y | - | QR 코드를 직접 스캔 처리해 준 현장 스태프 ID |
| **scan_type** | `VARCHAR(20)` | N | - | N | - | 스캔 분류 (ENTRANCE: 입장게이트, STORE_PICKUP: 부스수령) |
| **result** | `VARCHAR(20)` | N | - | N | SUCCESS | 스캔 인증 결과 상태 (성공, 만료, 중복) |
| **scanned_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | QR 코드가 인식된 실시간 스캔시간 |

---

## 📋 테이블명: `wishlist`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 보관함 고유 식별자 (cart_no / wish_no 매핑) |
| **user_id** | `BIGINT` | N | app_user(id) | N | - | 보관함을 소유한 회원 ID |
| **product_id** | `BIGINT` | N | product(id) | N | - | 담아둔 대상 상품 고유 ID |
| **item_type** | `VARCHAR(20)` | N | - | N | - | 장바구니에 담긴 품목의 타입 (TICKET, FOOD, GOODS) |
| **wish_type** | `VARCHAR(20)` | N | - | N | - | 보관 유형 데이터 구분 (CART: 통합 장바구니, WISH: 관심 찜 목록) |
| **ref_no** | `BIGINT` | N | - | Y | - | 좌석 예매권이나 특정 대상 구별을 위한 참조번호 |
| **quantity** | `INT` | N | - | N | 1 | 장바구니에 담은 선택 수량 |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 보관 담은 일시 |

---

## 📋 테이블명: `wallet_history`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 금융 거래 내역 고유 식별자 (tx_no 매핑) |
| **user_id** | `BIGINT` | N | app_user(id) | N | - | 통장 내역의 주인인 회원 ID |
| **transaction_type** | `VARCHAR(20)` | N | - | N | - | 거래 유형 데이터 (CHARGE: 충전, PAY: 결제, REFUND: 환불) |
| **amount** | `INT` | N | - | N | - | 거래 변동 금액 (충전은 +, 결제는 -) |
| **description** | `VARCHAR(255)` | N | - | Y | - | 마이페이지 영수증 표기용 비고 |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 거래 완료 시각 (거래일시) |

---

## 📋 테이블명: `settlement`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 정산 고유 식별자 (settlement_no 매핑) |
| **store_id** | `BIGINT` | N | store(id) | N | - | 정산 대상 가맹점 입점 업체 ID |
| **settlement_month** | `VARCHAR(10)` | N | - | N | - | 정산 대상_월 (ex: '2026-05') |
| **total_sales_amount** | `INT` | N | - | N | 0 | 해당 상점의 기간 총매출액 |
| **commission_fee** | `INT` | N | - | N | 0 | 플랫폼 중개 수수료 |
| **final_payout_amount** | `INT` | N | - | N | 0 | 수수료 제외 최종지급액 |
| **status** | `VARCHAR(20)` | N | - | N | 정산대기 | 정산 처리 단계 상태 (정산대기, 정산완료) |
| **updated_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 정산 마감 처리 일시 |

---

## 📋 테이블명: `inquiry`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 문의 고유 식별자 (inq_no 매핑) |
| **user_id** | `BIGINT` | N | app_user(id) | N | - | 문의를 등록한 회원 ID |
| **category** | `VARCHAR(50)` | N | - | N | - | 문의분류 (ex: '결제/환불', '출입/QR') |
| **title** | `VARCHAR(150)` | N | - | N | - | 문의 내용 제목 |
| **content** | `TEXT` | N | - | N | - | 문의내용 본문 텍스트 |
| **status** | `VARCHAR(20)` | N | - | N | 대기 | 처리 상태 (대기, 완료) |
| **answer_content** | `TEXT` | N | - | Y | - | 고객센터 관리자의 최종 답변내용 |
| **replied_at** | `TIMESTAMP` | N | - | Y | - | 답변 완료 등록 시각 |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 1:1 문의 접수 일시 |

---

## 📋 테이블명: `review`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 리뷰 고유 식별자 (review_no 매핑) |
| **user_id** | `BIGINT` | N | app_user(id) | Y | - | 리뷰 작성자 회원 ID |
| **store_id** | `BIGINT` | N | store(id) | Y | - | 리뷰가 등록될 대상 상점 ID |
| **festival_id** | `BIGINT` | N | festival(id) | Y | - | 리뷰가 등록될 대상 축제 ID |
| **order_item_id** | `BIGINT` | N | order_item(id) | Y | - | [내돈내산 검증] 현장 수령 완료 품목 외래키 |
| **rating** | `INT` | N | - | N | - | 만족도 별점 수치 (1~5점) |
| **content** | `TEXT` | N | - | N | - | 리뷰 상세 텍스트 내용 |
| **image_url** | `TEXT` | N | - | Y | - | 포토 리뷰 이미지URL 경로 |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 리뷰 작성 일시 |

---

## 📋 테이블명: `coupon`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 쿠폰 정책 고유 식별자 |
| **title** | `VARCHAR(100)` | N | - | N | - | 쿠폰 명칭 (ex: 'VIP 등급 전용 푸드 3,000원 할인권') |
| **discount_type** | `VARCHAR(20)` | N | - | N | - | 할인 계산 타입 (FIXED: 정액, PERCENT: 정률) |
| **discount_value** | `INT` | N | - | N | - | 할인 기준 수치 |
| **min_order_price** | `INT` | N | - | N | 0 | 최소 주문 적용 금액 조건 |
| **expiry_date** | `TIMESTAMP` | N | - | N | - | 쿠폰 사용 만료 기한 시각 |

---

## 📋 테이블명: `user_coupon`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 유저 쿠폰 소유 고유 ID |
| **user_id** | `BIGINT` | N | app_user(id) | N | - | 쿠폰 소유 회원 ID |
| **coupon_id** | `BIGINT` | N | coupon(id) | N | - | 연동된 상위 쿠폰 마스터 ID |
| **is_used** | `BOOLEAN` | N | - | N | FALSE | 사용 완료 여부 변동 플래그 |
| **used_at** | `TIMESTAMP` | N | - | Y | - | 실제로 결제창에서 쿠폰을 소진한 시각 |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 쿠폰 다운로드/발급 일시 |

---

## 📋 테이블명: `emergency_broadcast`

| 컬럼명 (Physical) | 데이터 타입 | PK | FK (논리 매핑) | Null | 기본값 | 컬럼 설명 / 제약 조건 |
| :--- | :--- | :---: | :--- | :---: | :--- | :--- |
| **id** | `BIGSERIAL` | Y | - | N | 자동 증가 | 긴급 알림 고유 식별자 |
| **festival_id** | `BIGINT` | N | festival(id) | N | - | 원격 제어 대상 페스티벌 ID |
| **title** | `VARCHAR(100)` | N | - | N | - | 알림 헤드라인 |
| **content** | `TEXT` | N | - | N | - | 긴급 상황 전파 대피 행동 요령 가이드 메시지 |
| **urgency_level** | `VARCHAR(20)` | N | - | N | INFO | 긴급도 구분 등급 (INFO, CAUTION, EMERGENCY) |
| **created_at** | `TIMESTAMP` | N | - | N | CURRENT_TIMESTAMP | 방송 송출 처리 타임스탬프 |