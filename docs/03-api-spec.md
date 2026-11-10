# 3단계: API 명세

후속 상태: `/auth/*`의 가입·확인·로그인·로그아웃·재설정, `/admin/session`, 개발 전용 수신함을 [4단계](04-auth-implementation.md)에서 추가했다. 아래 ‘현재 구현’ 구분은 3단계 시점의 계약이며 실제 최신 구현 범위는 4단계 기록을 따른다.

기본 경로 `/api/v1`, JSON UTF-8. **아래에서 ‘현재 구현’으로 표시한 공개 GET 두 개와 `/api/health`만 실행 가능하다.** 나머지는 다음 단계의 구현 계약이다.

## 공통 규약

- 목록: `{data:[],page:1,pageSize:9,total:10}`. page ≥ 1, pageSize 1~100. 요청한 페이지가 범위를 넘으면 빈 data를 반환한다. UI가 현재 페이지를 조정한다.
- 오류: `{error:{code:"VALIDATION_ERROR",message:"입력값을 확인해주세요.",fields:{email:"이메일 형식을 확인해주세요."}}}`. SQL·스택·토큰·계정 존재 여부는 노출하지 않는다.
- 상태: 200 조회/수정, 201 생성, 202 이메일 요청 접수, 204 로그아웃/삭제, 400 입력 형식, 401 인증, 403 권한/CSRF, 404 공개되지 않거나 접근 불가한 개별 리소스, 409 재고/중복/상태 충돌, 429 시도 제한.
- 변경 요청: Origin과 `X-CSRF-Token`, 주문 생성·승인·환불은 `Idempotency-Key`. 사용자 ID와 역할은 요청 본문이 아닌 서버 세션에서 결정한다.
- 인증·주소·주문 응답은 no-store, 운영 HTTPS. 현재 공개 개발 API도 편의를 위해 no-store를 사용한다.
- GET 링크 클릭만으로 비밀번호 변경·구독 신청·토큰 소비를 실행하지 않는다.

## 현재 구현: 공개 읽기

| 메서드·경로 | 입력 | 응답 |
|---|---|---|
| GET `/api/health` | 없음 | status, stage, schemaVersion, authImplemented=false, paymentsEnabled=false, mailEnabled=false |
| GET `/farmers` | page, pageSize, q | 공개 농부의 id/name/person/region/crops/story/photoKey/isExample. 알림 이메일 제외 |
| GET `/products` | page, pageSize, farmerId | 공개 판매 상태 상품의 id/name/farmerId/farmerName/category/status, variants 배열(id/label/price/availableStock) |

현재 DB의 예시 상품은 옵션이 1개씩이지만 응답은 여러 옵션을 담을 수 있는 구조다. farmer 소개 비공개와 상품 판매 상태는 별개이며, 소개 비공개만으로 상품을 자동 중지하지 않는다. 상품명 검색·분류 필터·상세 GET은 다음 연결 단계에서 확장한다.

## 회원 인증 계약

| 메서드·경로 | 입력 | 결과와 권한 |
|---|---|---|
| GET `/auth/csrf` | 없음 | 가입 전/세션 CSRF 토큰 발급, no-store |
| POST `/auth/register` | email, password, consentVersions | 202 일관된 안내. pending 회원+확인 메일 작업. 기존 계정 여부 노출 안 함 |
| POST `/auth/email/confirm` | token | 일회용 토큰 소비, active 전환. 자동 관리자 권한 없음 |
| POST `/auth/email/resend` | email | 202 일관된 안내, 빈도 제한 |
| POST `/auth/login` | email, password | 성공 시 HttpOnly 세션 쿠키, `{data:{user:{id,email,role},csrfToken}}` |
| GET `/auth/me` | 쿠키 | 본인 user 또는 401, 비밀번호 해시/세션 원문 제외 |
| POST `/auth/logout` | 쿠키·CSRF | 세션 폐기, 쿠키 삭제 |
| POST `/auth/password/request` | email | 202 일관된 안내, 재설정 메일 |
| POST `/auth/password/reset` | token, newPassword | 일회용 소비, 비밀번호 갱신, 기존 세션 전체 폐기 |

가입 이메일 확인 화면과 비밀번호 재설정 화면은 기존 4173 UI에 아직 없다. 위 계약 구현 시 함께 추가한다.

## 공개 콘텐츠·구매 계약

| 메서드·경로 | 입력/권한 | 동작 |
|---|---|---|
| GET `/farmers/{id}` | 공개 소개 | 소개와 농부 ID 제공, 상품은 `/products?farmerId=`로 조회 |
| GET `/products/{id}` | 공개 상품 | 옵션·생산·배송 정책·발송 안내 |
| GET/PUT `/cart` | 회원 세션 또는 익명 장바구니 쿠키 | 옵션별 수량 조회/교체, 서버 가격 적용 |
| POST `/checkout/quote` | items:[{variantId,quantity}], destination | 가격·주소/배송 가능 여부·농부별 합계 계산. 예약 아님 |
| POST `/orders` | 동일 items, buyer, recipient, consentVersions, 멱등키 | 회원/비회원 주문·15분 예약·농부별 배송 묶음 생성 |
| POST `/payments/confirm` | orderId,paymentKey, 멱등키 + 주문 소유 증명 | PG 서버 검증 후 결제 확정. 입력 amount만 신뢰하지 않음 |
| POST `/payments/webhook` | 제공사 통보 | 제공사 기준 검증·재조회·이벤트 중복 방지. CSRF 대신 서버 검증 |
| GET `/orders` | 회원 | 본인 목록만 |
| GET `/orders/{id}` | 회원 본인 또는 주문 한정 비회원 세션 | 농부별 배송, 결제/환불 요약. 내부 전달 상태 제외 |
| POST `/guest-orders/access/request` | orderNumber,email | 202 일관된 안내, 주문 범위 확인 메일 |
| POST `/guest-orders/access/confirm` | token | 일회용 확인 후 주문 한정 세션 쿠키 발급 |
| POST `/orders/{id}/cancellations` | 소유권·items/quantities/reason·멱등키 | 출고·취소 가능 수량 확인 후 요청 생성 |

예시 주문 생성 본문:

```json
{
  "items": [{"variantId":"tomato-default","quantity":1}],
  "buyer": {"name":"테스트","email":"test@example.invalid","phone":"테스트용 값"},
  "recipient": {"name":"테스트","phone":"테스트용 값","postalCode":"확인 필요","address":"테스트 주소","detail":"","message":""},
  "consentVersions": ["운영 시 확정한 문서 버전"]
}
```

문자열 예시의 주소·전화번호·동의 버전은 실제 검증을 통과하는 값이 아니며 실제 전송하지 않는다. 서버는 productId의 브라우저 표시 가격이 아니라 variantId로 DB 가격을 찾는다.

## 후기·문의·알림·견적 계약

| 경로 | 동작과 검증 |
|---|---|
| GET `/products/{id}/reviews` | 공개 후기, 작성자 이메일·주문 개인정보 제외 |
| POST `/order-items/{id}/review` | 본인 구매·배송 완료 확인, 항목당 1개 |
| PATCH/DELETE `/reviews/{id}` | 작성자 확인, 변경/삭제 기록 |
| GET/POST `/products/{id}/inquiries` | 공개 답변 또는 본인 비공개 문의만 조회·작성 |
| POST `/inquiries/access/request`, `/confirm` | 비회원 문의의 이메일 확인과 범위 토큰 교환 |
| POST `/alerts` | productId, kind, email, consentVersion, 판매 회차. 확인 메일 후 활성화 |
| POST `/alerts/confirm` | 일회용 토큰 소비 |
| POST `/alerts/unsubscribe` | 해지 전용 토큰 검증, 해당 구독만 해지 |
| POST `/business-quotes` | 업체·담당자·이메일·연락처·품목·수량·납기·배송지·동의 버전 |
| GET `/content` | 공개 이야기·공지·FAQ·정책, kind/page/pageSize |

## 공동 운영자 계약

모든 `/admin/*`는 서버 admin 세션·CSRF를 검증한다. 로컬 미리보기의 `#manage-farmers`는 이 권한 보호를 아직 갖추지 않았으며 운영용으로 공개하지 않는다.

| 경로 | 동작 |
|---|---|
| GET/POST `/admin/farmers`, PATCH `/admin/farmers/{id}` | 소개·공개·표시 순서·주문 수신 정보 |
| DELETE `/admin/farmers/{id}` | 상품/주문 연결 시 삭제 거절, 비공개/보관 안내 |
| PUT `/admin/farmers/{id}/shipping` | 배송비·무료 기준·주소 규칙·버전 |
| POST `/admin/uploads` | 이미지 실제 디코딩·크기·파일 키 검증 |
| GET/POST `/admin/products`, PATCH `/admin/products/{id}` | 상품·옵션·판매 상태, 회차 전환 이벤트 |
| PATCH `/admin/variants/{id}/stock` | 현재 예약보다 낮은 재고 금지, 변경 사유 감사 기록 |
| GET `/admin/orders`, `/admin/orders/{id}` | 농부·결제·배송·전달 상태를 별도 필드로 반환 |
| PATCH `/admin/shipments/{id}` | 운송장·상태 입력, 해당 주문 이력 |
| GET `/admin/email-jobs` | 전달 상태·시도·민감정보 없는 오류 |
| POST `/admin/email-jobs/{id}/retry` | 새 시도 생성·중복 방지·감사 기록 |
| POST `/admin/refunds/{id}/approve` | 환불 대상·수량·누적 금액·멱등 처리 |
| GET/PATCH `/admin/business-quotes/{id}` | 견적 검토·회신·종료 |
| PATCH `/admin/inquiries/{id}`, `/admin/reviews/{id}` | 답변·후기 숨김 및 이력 |
| GET/POST/PATCH `/admin/content` | 콘텐츠·정책 버전 관리 |
| GET `/admin/farmers/{id}/order-export` | 농부별 주문·취소·환불 내보내기, 정산 자동 지급 아님 |
| POST `/farmer-access/exchange` | 만료·폐기·묶음 범위 링크 토큰을 제한 세션으로 교환 |
| GET `/farmer-access/shipment` | 해당 농부 배송 묶음 1개만 조회, 개인정보 최소 범위 |

## 구현 우선순위와 검증

다음 단계에서 인증 경로와 서버 세션·권한을 먼저 구현하고 기존 관리 화면을 연결한다. 주문·결제·메시지 경로는 각 후속 단계에서 연결한다. 설계 표에 있는 경로가 존재한다고 가정하거나 현재 프런트엔드에서 호출하지 않는다.

현재 통합 테스트는 실제 HTTP 서버를 임시 포트로 띄워 공개 API·잘못된 페이지·POST 거절·미구현 로그인 응답을 확인한다. 향후 인증 테스트는 세션 쿠키로 직접 HTTP를 시험하며 실제 사용자 계정·외부 메시지 없이 독립 DB와 로컬 테스트 수신함을 사용한다.
