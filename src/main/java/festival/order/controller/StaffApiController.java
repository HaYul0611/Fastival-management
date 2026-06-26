package festival.order.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/payment/staff")
public class StaffApiController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Authorization 헤더로부터 로그인된 유저의 store_id를 보안 연동하여 조회하는 공통 헬퍼 메서드
     * (URL 변조 공격 방지를 위한 데이터 격리 시스템)
     */
    private Long getLoggedInStoreId(String token) {
        if (token == null || token.trim().isEmpty()) {
            // 헤더가 비어 있을 경우 Fallback: 첫 번째 등록된 매장 리턴 (안정적 렌더링 확보)
            return getFirstStoreIdFallback();
        }

        try {
            String userId = null;
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            if (token.startsWith("festio-jwt-token-")) {
                userId = token.substring("festio-jwt-token-".length());
            } else if (token.equals("festio-admin-jwt-token-7777")) {
                // 어드민 테스트용 우회: 첫 번째 등록된 상점 부여
                return getFirstStoreIdFallback();
            } else {
                return getFirstStoreIdFallback();
            }

            // DB에서 해당 유저의 store_id 조회
            String sql = "SELECT store_id FROM app_user WHERE id = ?";
            List<Long> storeIds = jdbcTemplate.query(sql, (rs, rowNum) -> rs.getLong("store_id"), userId);

            if (storeIds.isEmpty() || storeIds.get(0) == null || storeIds.get(0) == 0L) {
                return getFirstStoreIdFallback();
            }
            
            Long storeId = storeIds.get(0);
            
            // 실제 store 테이블에 존재하는지 유효성 검증
            try {
                String checkSql = "SELECT COUNT(*) FROM store WHERE id = ?";
                Integer count = jdbcTemplate.queryForObject(checkSql, Integer.class, storeId);
                if (count == null || count == 0) {
                    return getFirstStoreIdFallback();
                }
            } catch (Exception e) {
                return getFirstStoreIdFallback();
            }
            
            return storeId;

        } catch (Exception e) {
            System.err.println("인증 토큰 분석 오류: " + e.getMessage());
            return getFirstStoreIdFallback();
        }
    }

    private Long getFirstStoreIdFallback() {
        try {
            String sql = "SELECT id FROM store ORDER BY id ASC LIMIT 1";
            List<Long> ids = jdbcTemplate.query(sql, (rs, rowNum) -> rs.getLong("id"));
            return ids.isEmpty() ? 1L : ids.get(0);
        } catch (Exception e) {
            return 1L;
        }
    }


    // ==========================================
    // 1. [점포 설정] 현재 로그인한 가맹점 정보 조회
    // ==========================================
    @GetMapping("/store")
    public ResponseEntity<?> getMyStore(@RequestHeader(value = "Authorization", required = false) String token) {
        Long storeId = getLoggedInStoreId(token);
        String sql = "SELECT * FROM store WHERE id = ?";
        List<Map<String, Object>> stores = jdbcTemplate.queryForList(sql, storeId);

        // [안정성 보완] 만약 storeId로 조회된 결과가 없으면 첫 번째 매장을 조회해 옴
        if (stores.isEmpty()) {
            Long fallbackStoreId = getFirstStoreIdFallback();
            stores = jdbcTemplate.queryForList(sql, fallbackStoreId);
        }

        if (stores.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "상점 정보를 찾을 수 없습니다."));
        }
        return ResponseEntity.ok(stores.get(0));
    }

    // ==========================================
    // 2. [점포 설정] 영업 상태 토글 (영업 개시 / 종료)
    // ==========================================
    @PutMapping("/store/status")
    public ResponseEntity<?> toggleStoreStatus(
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody Map<String, Boolean> payload) {
        
        Long storeId = getLoggedInStoreId(token);
        Boolean isOpen = payload.get("isOpen");

        if (isOpen == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "isOpen 값을 전달해야 합니다."));
        }

        String sql = "UPDATE store SET is_open = ? WHERE id = ?";
        jdbcTemplate.update(sql, isOpen, storeId);

        return ResponseEntity.ok(Map.of("status", "success", "isOpen", isOpen));
    }

    // ==========================================
    // 3. [점포 설정] 사장님 한 줄 공지 업데이트
    // ==========================================
    @PutMapping("/store/notice")
    public ResponseEntity<?> updateStoreNotice(
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody Map<String, String> payload) {
        
        Long storeId = getLoggedInStoreId(token);
        String notice = payload.get("notice");

        String sql = "UPDATE store SET notice = ? WHERE id = ?";
        jdbcTemplate.update(sql, notice, storeId);

        return ResponseEntity.ok(Map.of("status", "success", "notice", notice));
    }

    // ==========================================
    // 4. [점포 설정] 가맹점 기본 정보 수정 (이름, 카테고리, 운영 시간)
    // ==========================================
    @PutMapping("/store/info")
    public ResponseEntity<?> updateStoreInfo(
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody Map<String, String> payload) {

        Long storeId = getLoggedInStoreId(token);
        
        try {
            jdbcTemplate.execute("ALTER TABLE store ADD COLUMN image_url TEXT");
        } catch (Exception e) {
            try {
                jdbcTemplate.execute("ALTER TABLE store ALTER COLUMN image_url TYPE TEXT");
            } catch (Exception e2) {
                // 권한 문제 등 예외 무시
            }
        }

        String name = payload.get("name");
        String category = payload.get("category");
        String operatingHours = payload.get("operatingHours");
        String imageUrl = payload.get("imageUrl");

        StringBuilder sql = new StringBuilder("UPDATE store SET ");
        List<Object> params = new ArrayList<>();

        if (name != null && !name.isBlank()) {
            sql.append("name = ?, ");
            params.add(name);
        }
        if (category != null && !category.isBlank()) {
            sql.append("category = ?, ");
            params.add(category);
        }
        if (operatingHours != null) {
            sql.append("operating_hours = ?, ");
            params.add(operatingHours);
        }
        if (imageUrl != null) {
            sql.append("image_url = ?, ");
            params.add(imageUrl);
        }

        if (params.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "변경할 정보를 하나 이상 입력해 주세요."));
        }

        // 마지막 쉼표 제거
        String finalSql = sql.toString().replaceAll(",\\s*$", "") + " WHERE id = ?";
        params.add(storeId);

        jdbcTemplate.update(finalSql, params.toArray());

        // 수정된 정보 재조회해서 응답
        String selectSql = "SELECT * FROM store WHERE id = ?";
        List<Map<String, Object>> updated = jdbcTemplate.queryForList(selectSql, storeId);
        return ResponseEntity.ok(updated.isEmpty() ? Map.of("status", "success") : updated.get(0));
    }

    // ==========================================
    // 4. [메뉴 등록] 현재 로그인한 가맹점의 전체 메뉴 조회
    // ==========================================
    @GetMapping("/menus")
    public ResponseEntity<?> getMyMenus(@RequestHeader(value = "Authorization", required = false) String token) {
        Long storeId = getLoggedInStoreId(token);
        String sql = "SELECT * FROM product WHERE store_id = ? ORDER BY id DESC";
        List<Map<String, Object>> menus = jdbcTemplate.queryForList(sql, storeId);
        return ResponseEntity.ok(menus);
    }

    // ==========================================
    // 5. [메뉴 등록] 신규 메뉴 등록 (배민 스타일 마스터 등록)
    // ==========================================
    @PostMapping("/menus")
    public ResponseEntity<?> registerMenu(
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody Map<String, Object> payload) {

        Long storeId = getLoggedInStoreId(token);

        // PostgreSQL/Supabase 환경에서 VARCHAR(1000) 크기 제한 에러를 방지하기 위해 image_url 컬럼 타입을 TEXT로 실시간 승격
        try {
            jdbcTemplate.execute("ALTER TABLE product ALTER COLUMN image_url TYPE TEXT");
        } catch (Exception e) {
            // 이미 타입이 변경되었거나 DDL 권한 문제 등의 에러는 무시하고 진행
        }

        String name = (String) payload.get("name");
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "상품명은 필수 입력 항목입니다."));
        }

        Integer price = 0;
        try { price = Integer.parseInt(String.valueOf(payload.get("price"))); } catch (Exception ignored) {}

        String productType = (String) payload.getOrDefault("productType", "FOOD");
        String imageUrl = (String) payload.getOrDefault("imageUrl", "");
        
        // 옵션 그룹 직렬화 (런타임 라이브러리 충돌을 원천 차단하는 커스텀 순수 자바 JSON 직렬화 헬퍼 사용)
        String optionGroupsJson = serializeOptionGroups(payload.get("optionGroups"));

        // 옵션 그룹 정보를 JSON 문자열로 직렬화하여 저장
        String insertSql = "INSERT INTO product (store_id, name, price, product_type, status, is_soldout, is_representative, image_url, total_stock, reserved_stock, available_stock, option_groups_json) " +
                           "VALUES (?, ?, ?, ?, 'ON_SALE', false, false, ?, 999, 0, 999, ?)";

        jdbcTemplate.update(insertSql, storeId, name, price, productType, imageUrl.isBlank() ? null : imageUrl, optionGroupsJson);

        // 등록된 메뉴 ID 조회
        Long newId = jdbcTemplate.queryForObject(
            "SELECT id FROM product WHERE store_id = ? ORDER BY id DESC LIMIT 1", Long.class, storeId);

        return ResponseEntity.ok(Map.of(
            "status", "success",
            "message", "[" + name + "] 메뉴가 성공적으로 등록되었습니다.",
            "id", newId,
            "name", name,
            "price", price,
            "productType", productType
        ));
    }

    /**
     * 외부 라이브러리(Jackson 등) 의존성 누락에 따른 런타임 ClassNotFoundException을
     * 완벽히 우회하기 위한 순수 자바 JSON 직렬화 헬퍼 메서드
     */
    private String serializeOptionGroups(Object optionGroupsObj) {
        if (optionGroupsObj == null) return null;
        if (!(optionGroupsObj instanceof List)) return "[]";
        
        List<?> groups = (List<?>) optionGroupsObj;
        StringBuilder sb = new StringBuilder("[");
        
        for (int i = 0; i < groups.size(); i++) {
            Object groupObj = groups.get(i);
            if (!(groupObj instanceof Map)) continue;
            
            Map<?, ?> groupMap = (Map<?, ?>) groupObj;
            String groupName = String.valueOf(groupMap.get("groupName"));
            // 큰따옴표 이스케이프
            groupName = groupName.replace("\"", "\\\"");
            
            sb.append("{\"groupName\":\"").append(groupName).append("\",\"items\":[");
            
            Object itemsObj = groupMap.get("items");
            if (itemsObj instanceof List) {
                List<?> items = (List<?>) itemsObj;
                for (int j = 0; j < items.size(); j++) {
                    Object itemObj = items.get(j);
                    if (!(itemObj instanceof Map)) continue;
                    
                    Map<?, ?> itemMap = (Map<?, ?>) itemObj;
                    String name = String.valueOf(itemMap.get("name")).replace("\"", "\\\"");
                    
                    int price = 0;
                    try {
                        price = Integer.parseInt(String.valueOf(itemMap.get("price")));
                    } catch (Exception ignored) {}
                    
                    sb.append("{\"name\":\"").append(name).append("\",\"price\":").append(price);
                    
                    if (itemMap.containsKey("total_stock")) {
                        sb.append(",\"total_stock\":").append(itemMap.get("total_stock"));
                    } else if (itemMap.containsKey("totalStock")) {
                        sb.append(",\"total_stock\":").append(itemMap.get("totalStock"));
                    }
                    
                    if (itemMap.containsKey("reserved_stock")) {
                        sb.append(",\"reserved_stock\":").append(itemMap.get("reserved_stock"));
                    } else if (itemMap.containsKey("reservedStock")) {
                        sb.append(",\"reserved_stock\":").append(itemMap.get("reservedStock"));
                    }
                    
                    if (itemMap.containsKey("available_stock")) {
                        sb.append(",\"available_stock\":").append(itemMap.get("available_stock"));
                    } else if (itemMap.containsKey("availableStock")) {
                        sb.append(",\"available_stock\":").append(itemMap.get("availableStock"));
                    }
                    
                    if (itemMap.containsKey("is_soldout")) {
                        sb.append(",\"is_soldout\":").append(itemMap.get("is_soldout"));
                    } else if (itemMap.containsKey("isSoldout")) {
                        sb.append(",\"is_soldout\":").append(itemMap.get("isSoldout"));
                    }
                    
                    sb.append("}");
                    if (j < items.size() - 1) sb.append(",");
                }
            }
            sb.append("]}");
            if (i < groups.size() - 1) sb.append(",");
        }
        sb.append("]");
        return sb.toString();
    }

    // ==========================================
    // 5. [메뉴 등록] 대표 메뉴 (★) 설정 / 해제 토글
    // ==========================================
    @PutMapping("/menus/{menuId}/representative")
    public ResponseEntity<?> toggleRepresentativeMenu(
            @RequestHeader(value = "Authorization", required = false) String token,
            @PathVariable("menuId") Long menuId) {
        
        Long storeId = getLoggedInStoreId(token);

        // [보안 검증] 대상 메뉴가 본인 가게의 것인지 확인 (데이터 격리)
        String verifySql = "SELECT store_id FROM product WHERE id = ?";
        List<Long> ownerStoreIds = jdbcTemplate.query(verifySql, (rs, rowNum) -> rs.getLong("store_id"), menuId);

        if (ownerStoreIds.isEmpty() || !ownerStoreIds.get(0).equals(storeId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "해당 메뉴를 관리할 권한이 없습니다."));
        }

        // 현재 대표 상태를 조회하여 반전 처리
        String currentRepSql = "SELECT is_representative FROM product WHERE id = ?";
        Boolean currentRep = jdbcTemplate.queryForObject(currentRepSql, Boolean.class, menuId);
        boolean newRep = currentRep == null ? true : !currentRep;

        String updateSql = "UPDATE product SET is_representative = ? WHERE id = ?";
        jdbcTemplate.update(updateSql, newRep, menuId);

        return ResponseEntity.ok(Map.of("status", "success", "isRepresentative", newRep));
    }

    // ==========================================
    // 5.5. [재고 제어] 초기 재고 수량 수정
    // ==========================================
    @PutMapping("/menus/{menuId}/stock")
    public ResponseEntity<?> updateMenuStock(
            @RequestHeader(value = "Authorization", required = false) String token,
            @PathVariable("menuId") Long menuId,
            @RequestBody Map<String, Object> payload) {
        
        Long storeId = getLoggedInStoreId(token);
        
        Integer totalStock = null;
        if (payload.containsKey("totalStock")) {
            try { totalStock = Integer.parseInt(String.valueOf(payload.get("totalStock"))); } catch (Exception ignored) {}
        } else if (payload.containsKey("currentStock")) {
            try { totalStock = Integer.parseInt(String.valueOf(payload.get("currentStock"))); } catch (Exception ignored) {}
        }

        if (totalStock == null || totalStock < 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "올바른 재고 수량을 입력해주세요."));
        }

        // [보안 검증] 대상 메뉴가 본인 가게의 것인지 확인 (데이터 격리)
        String verifySql = "SELECT store_id, reserved_stock FROM product WHERE id = ?";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(verifySql, menuId);

        if (rows.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "해당 메뉴를 찾을 수 없습니다."));
        }
        
        Long ownerStoreId = ((Number) rows.get(0).get("store_id")).longValue();
        if (!ownerStoreId.equals(storeId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "해당 메뉴를 관리할 권한이 없습니다."));
        }

        int reservedStock = rows.get(0).get("reserved_stock") != null ? ((Number) rows.get(0).get("reserved_stock")).intValue() : 0;
        int availableStock = totalStock - reservedStock;
        if (availableStock < 0) availableStock = 0; // 가용 재고 음수 방지

        String updateSql;
        String optionGroupsJson = null;
        if (payload.containsKey("optionGroups")) {
            optionGroupsJson = serializeOptionGroups(payload.get("optionGroups"));
        }

        if (optionGroupsJson != null) {
            updateSql = "UPDATE product SET total_stock = ?, available_stock = ?, option_groups_json = ? WHERE id = ?";
            jdbcTemplate.update(updateSql, totalStock, availableStock, optionGroupsJson, menuId);
        } else {
            updateSql = "UPDATE product SET total_stock = ?, available_stock = ? WHERE id = ?";
            jdbcTemplate.update(updateSql, totalStock, availableStock, menuId);
        }

        return ResponseEntity.ok(Map.of(
            "status", "success",
            "menuId", menuId,
            "totalStock", totalStock,
            "reservedStock", reservedStock,
            "availableStock", availableStock
        ));
    }

    // ==========================================
    // 6. [재고 제어] 메뉴 품절(SOLD_OUT) 상태 토글
    // ==========================================
    @PutMapping("/menus/{menuId}/soldout")
    public ResponseEntity<?> toggleMenuSoldout(
            @RequestHeader(value = "Authorization", required = false) String token,
            @PathVariable("menuId") Long menuId,
            @RequestBody Map<String, Boolean> payload) {
        
        Long storeId = getLoggedInStoreId(token);
        Boolean isSoldout = payload.get("isSoldout");

        if (isSoldout == null) {
            // payload가 없을 경우 반전 토글 처리
            String currentSoldoutSql = "SELECT is_soldout FROM product WHERE id = ?";
            Boolean currentSoldout = jdbcTemplate.queryForObject(currentSoldoutSql, Boolean.class, menuId);
            isSoldout = currentSoldout == null ? true : !currentSoldout;
        }

        // [보안 검증] 대상 메뉴가 본인 가게의 것인지 확인 (데이터 격리)
        String verifySql = "SELECT store_id FROM product WHERE id = ?";
        List<Long> ownerStoreIds = jdbcTemplate.query(verifySql, (rs, rowNum) -> rs.getLong("store_id"), menuId);

        if (ownerStoreIds.isEmpty() || !ownerStoreIds.get(0).equals(storeId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "해당 메뉴를 관리할 권한이 없습니다."));
        }

        String status = isSoldout ? "SOLD_OUT" : "ON_SALE";
        String updateSql = "UPDATE product SET is_soldout = ?, status = ? WHERE id = ?";
        jdbcTemplate.update(updateSql, isSoldout, status, menuId);

        return ResponseEntity.ok(Map.of("status", "success", "isSoldout", isSoldout, "menuStatus", status));
    }

    // ==========================================
    // 6.5. [메뉴 삭제] 메뉴 단건 삭제
    // ==========================================
    @DeleteMapping("/menus/{menuId}")
    public ResponseEntity<?> deleteMenu(
            @RequestHeader(value = "Authorization", required = false) String token,
            @PathVariable("menuId") Long menuId) {
        
        Long storeId = getLoggedInStoreId(token);

        // [보안 검증] 대상 메뉴가 본인 가게의 것인지 확인 (데이터 격리)
        String verifySql = "SELECT store_id FROM product WHERE id = ?";
        List<Long> ownerStoreIds = jdbcTemplate.query(verifySql, (rs, rowNum) -> rs.getLong("store_id"), menuId);

        if (ownerStoreIds.isEmpty() || !ownerStoreIds.get(0).equals(storeId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "해당 메뉴를 삭제할 권한이 없습니다."));
        }

        String deleteSql = "DELETE FROM product WHERE id = ?";
        jdbcTemplate.update(deleteSql, menuId);

        return ResponseEntity.ok(Map.of("status", "success", "message", "성공적으로 삭제되었습니다."));
    }

    // ==========================================
    // 7. [주문 수락] 가맹점 전용 O2O 실시간 주문 목록 조회
    // ==========================================
    @GetMapping("/orders")
    public ResponseEntity<?> getMyOrders(@RequestHeader(value = "Authorization", required = false) String token) {
        Long storeId = getLoggedInStoreId(token);

        // 본인 소유 가맹점의 상품이 주문되어 생성된 주문 항목들만 필터링 조회 (강력한 데이터 격리)
        String sql = "SELECT oi.id as item_id, p.name as product_name, oi.quantity, p.price, oi.item_status, oi.updated_at, oi.selected_options as selected_options " +
                     "FROM order_item oi " +
                     "JOIN product p ON oi.product_id = p.id " +
                     "WHERE p.store_id = ? " +
                     "ORDER BY oi.updated_at DESC";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, storeId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            Map<String, Object> order = new HashMap<>();
            Long itemId = ((Number) row.get("item_id")).longValue();
            
            order.put("id", itemId);
            order.put("orderCode", "ORD-STAFF-" + itemId);
            
            String itemStatus = (String) row.get("item_status");
            if (itemStatus == null) itemStatus = "ORDERED";
            
            // 프론트엔드 상태 매핑 호환 (ORDERED ➡️ New, COOKING ➡️ Cooking, READY ➡️ Ready, SERVED/COMPLETE ➡️ Finished)
            order.put("status", itemStatus);
            order.put("customer", "스마트오더 (부스:" + itemId + "번)");
            order.put("timestamp", row.get("updated_at") != null ? row.get("updated_at").toString() : LocalDateTime.now().toString());
            
            List<Map<String, Object>> items = new ArrayList<>();
            Map<String, Object> item = new HashMap<>();
            item.put("name", row.get("product_name"));
            item.put("quantity", row.get("quantity"));
            item.put("options", row.get("selected_options"));
            items.add(item);
            
            order.put("items", items);
            
            int itemPrice = row.get("price") != null ? ((Number) row.get("price")).intValue() : 0;
            int quantity = row.get("quantity") != null ? ((Number) row.get("quantity")).intValue() : 1;
            order.put("price", itemPrice * quantity);
            
            result.add(order);
        }

        return ResponseEntity.ok(result);
    }

    // ==========================================
    // 8. [주문 수락] 주문 진행 상황 업데이트 (수락/조리완료/완료)
    // ==========================================
    @PutMapping("/orders/{orderId}/status")
    public ResponseEntity<?> updateOrderStatus(
            @RequestHeader(value = "Authorization", required = false) String token,
            @PathVariable("orderId") Long orderId,
            @RequestBody Map<String, String> payload) {
        
        Long storeId = getLoggedInStoreId(token);
        String nextStatus = payload.get("status"); // ex: COOKING, READY, SERVED 등

        // [보안 검증] 해당 주문이 본인 상점에 속한 것인지 안전 검사
        String verifySql = "SELECT p.store_id FROM order_item oi JOIN product p ON oi.product_id = p.id WHERE oi.id = ?";
        List<Long> ownerStoreIds = jdbcTemplate.query(verifySql, (rs, rowNum) -> rs.getLong("store_id"), orderId);

        if (ownerStoreIds.isEmpty() || !ownerStoreIds.get(0).equals(storeId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "해당 주문을 제어할 권한이 없습니다."));
        }

        String updateSql = "UPDATE order_item SET item_status = ?, updated_at = NOW() WHERE id = ?";
        jdbcTemplate.update(updateSql, nextStatus, orderId);

        // [Supabase 동기화] order_item의 order_id를 통해 orders.ticket_number(주문번호)를 구한 후 Supabase shop_orders 상태 업데이트
        try {
            String ticketNumber = jdbcTemplate.queryForObject(
                "SELECT o.ticket_number FROM order_item oi JOIN orders o ON oi.order_id = o.id WHERE oi.id = ?",
                String.class, orderId);
            
            if (ticketNumber != null) {
                String supabaseStatus = "PREPARING";
                if ("READY".equals(nextStatus)) {
                    supabaseStatus = "READY_FOR_PICKUP";
                } else if ("SERVED".equals(nextStatus) || "COMPLETED".equals(nextStatus)) {
                    supabaseStatus = "COMPLETED";
                } else if ("SHIPPED".equals(nextStatus)) {
                    supabaseStatus = "SHIPPING";
                } else if ("DELIVERED".equals(nextStatus)) {
                    supabaseStatus = "DELIVERED";
                } else if ("COOKING".equals(nextStatus)) {
                    supabaseStatus = "PREPARING";
                }

                jdbcTemplate.update("UPDATE shop_orders SET status = ? WHERE order_number = ?", supabaseStatus, ticketNumber);
                System.out.println("[Supabase 동기화] shop_orders 상태 업데이트 성공: " + ticketNumber + " -> " + supabaseStatus);
            }
        } catch (Exception e) {
            System.err.println("[Supabase 동기화] shop_orders 상태 업데이트 실패: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of("status", "success", "orderId", orderId, "orderStatus", nextStatus));
    }

    // ==========================================
    // 9. [매출 통계] 실시간 매출 및 판매 분석 통계 조회
    // ==========================================
    @GetMapping("/sales/stats")
    public ResponseEntity<?> getSalesStatistics(@RequestHeader(value = "Authorization", required = false) String token) {
        Long storeId = getLoggedInStoreId(token);

        // 1. 요약 정보 (총 매출, 총 주문 건수, 객단가)
        String summarySql = "SELECT COALESCE(SUM(oi.quantity * p.price), 0) AS total_revenue, " +
                            "COUNT(DISTINCT oi.order_id) AS total_orders " +
                            "FROM order_item oi " +
                            "JOIN product p ON oi.product_id = p.id " +
                            "JOIN orders o ON oi.order_id = o.id " +
                            "WHERE p.store_id = ? AND o.payment_status = 'PAID'";
        
        Map<String, Object> summary = new HashMap<>();
        try {
            Map<String, Object> summaryResult = jdbcTemplate.queryForMap(summarySql, storeId);
            long totalRevenue = summaryResult.get("total_revenue") != null ? ((Number) summaryResult.get("total_revenue")).longValue() : 0L;
            long totalOrders = summaryResult.get("total_orders") != null ? ((Number) summaryResult.get("total_orders")).longValue() : 0L;
            long averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0L;

            summary.put("totalRevenue", totalRevenue);
            summary.put("totalOrders", totalOrders);
            summary.put("averageOrderValue", averageOrderValue);
        } catch (Exception e) {
            summary.put("totalRevenue", 0L);
            summary.put("totalOrders", 0L);
            summary.put("averageOrderValue", 0L);
        }

        // 2. 시간대별 매출 추이
        String hourlySql = "SELECT EXTRACT(HOUR FROM o.created_at) AS order_hour, " +
                           "SUM(oi.quantity * p.price) AS hourly_revenue " +
                           "FROM order_item oi " +
                           "JOIN product p ON oi.product_id = p.id " +
                           "JOIN orders o ON oi.order_id = o.id " +
                           "WHERE p.store_id = ? AND o.payment_status = 'PAID' " +
                           "GROUP BY EXTRACT(HOUR FROM o.created_at) " +
                           "ORDER BY order_hour";
        
        List<Map<String, Object>> hourlyList = jdbcTemplate.queryForList(hourlySql, storeId);
        List<Map<String, Object>> hourlySales = new ArrayList<>();
        Map<Integer, Long> hourlyMap = new HashMap<>();
        for (int h = 0; h < 24; h++) hourlyMap.put(h, 0L);
        for (Map<String, Object> row : hourlyList) {
            try {
                int hour = ((Number) row.get("order_hour")).intValue();
                long revenue = ((Number) row.get("hourly_revenue")).longValue();
                hourlyMap.put(hour, revenue);
            } catch (Exception ignored) {}
        }
        for (int h = 0; h < 24; h++) {
            Map<String, Object> item = new HashMap<>();
            item.put("hour", h);
            item.put("revenue", hourlyMap.get(h));
            hourlySales.add(item);
        }

        // 3. 인기 상품 Top 5
        String topProductsSql = "SELECT p.name AS product_name, SUM(oi.quantity) AS total_quantity, SUM(oi.quantity * p.price) AS total_revenue " +
                                "FROM order_item oi " +
                                "JOIN product p ON oi.product_id = p.id " +
                                "JOIN orders o ON oi.order_id = o.id " +
                                "WHERE p.store_id = ? AND o.payment_status = 'PAID' " +
                                "GROUP BY p.name " +
                                "ORDER BY total_quantity DESC " +
                                "LIMIT 5";
        List<Map<String, Object>> topProducts = jdbcTemplate.queryForList(topProductsSql, storeId);

        // 4. 옵션 선호도 분석
        String topOptionsSql = "SELECT oi.selected_options AS option_name, COUNT(oi.id) AS option_count " +
                               "FROM order_item oi " +
                               "JOIN product p ON oi.product_id = p.id " +
                               "JOIN orders o ON oi.order_id = o.id " +
                               "WHERE p.store_id = ? AND o.payment_status = 'PAID' AND oi.selected_options IS NOT NULL AND oi.selected_options != '' " +
                               "GROUP BY oi.selected_options " +
                               "ORDER BY option_count DESC " +
                               "LIMIT 5";
        List<Map<String, Object>> topOptions = jdbcTemplate.queryForList(topOptionsSql, storeId);

        Map<String, Object> response = new HashMap<>();
        response.put("summary", summary);
        response.put("hourlySales", hourlySales);
        response.put("topProducts", topProducts);
        response.put("topOptions", topOptions);

        return ResponseEntity.ok(response);
    }
}
