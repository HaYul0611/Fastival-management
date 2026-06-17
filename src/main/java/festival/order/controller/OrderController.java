package festival.order.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/order")
public class OrderController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/fnb")
    public List<Map<String, Object>> getFnbOrders(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        String userId = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (token.startsWith("festio-jwt-token-")) {
                userId = token.substring("festio-jwt-token-".length());
            } else if (token.equals("festio-admin-jwt-token-7777")) {
                try {
                    userId = jdbcTemplate.queryForObject(
                            "SELECT id FROM app_user WHERE email = 'admin@gmail.com'", String.class);
                } catch (Exception e) {
                    // 무시
                }
            }
        }

        String sql;
        List<Map<String, Object>> rows;
        if (userId != null) {
            sql = "SELECT oi.id as item_id, p.name as product_name, oi.quantity, p.price, oi.item_status, oi.updated_at "
                    +
                    "FROM order_item oi " +
                    "JOIN product p ON oi.product_id = p.id " +
                    "JOIN orders o ON oi.order_id = o.id " +
                    "WHERE oi.product_type = 'FOOD' AND o.user_id = ? " +
                    "ORDER BY oi.updated_at DESC";
            rows = jdbcTemplate.queryForList(sql, userId);
        } else {
            sql = "SELECT oi.id as item_id, p.name as product_name, oi.quantity, p.price, oi.item_status, oi.updated_at "
                    +
                    "FROM order_item oi " +
                    "JOIN product p ON oi.product_id = p.id " +
                    "JOIN orders o ON oi.order_id = o.id " +
                    "WHERE oi.product_type = 'FOOD' AND o.user_id IS NULL " +
                    "ORDER BY oi.updated_at DESC";
            rows = jdbcTemplate.queryForList(sql);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> order = new HashMap<>();

            Long itemId = ((Number) row.get("item_id")).longValue();
            order.put("id", String.format("F%011d", itemId));
            order.put("type", "FOOD");

            String itemStatus = (String) row.get("item_status");
            if (itemStatus == null || itemStatus.equals("ORDERED") || itemStatus.equals("PAID")
                    || itemStatus.isEmpty()) {
                itemStatus = "RECEIVED";
            }
            order.put("status", itemStatus);

            order.put("customer", "고객 (ID:" + itemId + ")");
            order.put("timestamp", row.get("updated_at") != null ? row.get("updated_at").toString() : "");

            List<Map<String, Object>> items = new ArrayList<>();
            Map<String, Object> item = new HashMap<>();
            item.put("name", row.get("product_name"));
            item.put("quantity", row.get("quantity"));
            items.add(item);

            order.put("items", items);

            int itemPrice = row.get("price") != null ? ((Number) row.get("price")).intValue() : 0;
            int quantity = row.get("quantity") != null ? ((Number) row.get("quantity")).intValue() : 1;
            order.put("price", itemPrice * quantity);

            result.add(order);
        }

        return result;
    }

    @PutMapping("/fnb/{id}/status")
    public Map<String, String> updateFnbStatus(@PathVariable("id") String idStr,
            @RequestBody Map<String, String> payload) {
        String nextStatus = payload.get("status");
        Long itemId = Long.parseLong(idStr.substring(1));

        String sql = "UPDATE order_item SET item_status = ? WHERE id = ?";
        jdbcTemplate.update(sql, nextStatus, itemId);

        Map<String, String> res = new HashMap<>();
        res.put("status", "success");
        return res;
    }

    @GetMapping("/goods")
    public List<Map<String, Object>> getGoodsOrders() {
        String sql = "SELECT oi.id as item_id, p.name as product_name, oi.quantity, p.price, oi.item_status, oi.updated_at "
                +
                "FROM order_item oi " +
                "JOIN product p ON oi.product_id = p.id " +
                "WHERE oi.product_type = 'GOODS' " +
                "ORDER BY oi.updated_at DESC";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> order = new HashMap<>();

            Long itemId = ((Number) row.get("item_id")).longValue();
            order.put("id", String.format("G%011d", itemId));
            order.put("type", "GOODS");

            String itemStatus = (String) row.get("item_status");
            if (itemStatus == null)
                itemStatus = "ORDERED";
            order.put("status", itemStatus);

            order.put("customer", "고객 (ID:" + itemId + ")");
            order.put("timestamp", row.get("updated_at") != null ? row.get("updated_at").toString() : "");

            List<Map<String, Object>> items = new ArrayList<>();
            Map<String, Object> item = new HashMap<>();
            item.put("name", row.get("product_name"));
            item.put("quantity", row.get("quantity"));
            items.add(item);

            order.put("items", items);

            int itemPrice = row.get("price") != null ? ((Number) row.get("price")).intValue() : 0;
            int quantity = row.get("quantity") != null ? ((Number) row.get("quantity")).intValue() : 1;
            order.put("price", itemPrice * quantity);

            result.add(order);
        }

        return result;
    }

    @PutMapping("/goods/{id}/status")
    public Map<String, String> updateGoodsStatus(@PathVariable("id") String idStr,
            @RequestBody Map<String, String> payload) {
        String nextStatus = payload.get("status");
        Long itemId = Long.parseLong(idStr.substring(1));

        String sql = "UPDATE order_item SET item_status = ? WHERE id = ?";
        jdbcTemplate.update(sql, nextStatus, itemId);

        Map<String, String> res = new HashMap<>();
        res.put("status", "success");
        return res;
    }

    @GetMapping("/seats")
    public List<Map<String, Object>> getAllSeats(@RequestParam(value = "zones", required = false) String zonesParam) {
        String sql = "SELECT SUBSTRING(seat_row, 1, 1) as zone, seat_number " +
                "FROM seat_map ";

        List<Map<String, Object>> rows;
        if (zonesParam != null && !zonesParam.isEmpty()) {
            List<String> zonesList = Arrays.asList(zonesParam.split(","));
            String inSql = String.join(",", Collections.nCopies(zonesList.size(), "?"));
            sql += "WHERE SUBSTRING(seat_row, 1, 1) IN (" + inSql + ") ";
            sql += "ORDER BY zone, seat_number";
            rows = jdbcTemplate.queryForList(sql, zonesList.toArray());
        } else {
            sql += "ORDER BY zone, seat_number";
            rows = jdbcTemplate.queryForList(sql);
        }

        List<Map<String, Object>> activeOrders = jdbcTemplate.queryForList(
                "SELECT seat_ids, is_entered FROM orders WHERE payment_status = 'PAID' AND seat_ids IS NOT NULL");

        Set<String> reservedSeats = new HashSet<>();
        Set<String> enteredSeats = new HashSet<>();

        for (Map<String, Object> order : activeOrders) {
            String seatIdsStr = (String) order.get("seat_ids");
            Boolean isEntered = (Boolean) order.get("is_entered");
            if (seatIdsStr != null && !seatIdsStr.isEmpty()) {
                String[] seats = seatIdsStr.split(",");
                for (String s : seats) {
                    String cleanSeat = s.trim();
                    reservedSeats.add(cleanSeat);
                    if (isEntered != null && isEntered) {
                        enteredSeats.add(cleanSeat);
                    }
                }
            }
        }

        List<Map<String, Object>> allSeats = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            Map<String, Object> seat = new HashMap<>();
            String zone = (String) row.get("zone");
            Number number = (Number) row.get("seat_number");
            String seatId = zone + "-" + number;

            seat.put("id", seatId);
            seat.put("zone", zone);
            seat.put("number", number);
            seat.put("isReserved", reservedSeats.contains(seatId));
            seat.put("isEntered", enteredSeats.contains(seatId));
            allSeats.add(seat);
        }

        return allSeats;
    }

    @GetMapping("/debug/seats")
    public List<Map<String, Object>> debugSeats() {
        return jdbcTemplate.queryForList("SELECT * FROM seat_map");
    }

    // -------------------------------------------------------------
    // [Supabase DB 기반 QR 데이터 연동 및 TOTP]
    // -------------------------------------------------------------

    private String generateRandomTicketNumber() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder("T");
        Random rnd = new Random();
        for (int i = 0; i < 11; i++)
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        return sb.toString();
    }

    private String generateHexSecret() {
        java.security.SecureRandom random = new java.security.SecureRandom();
        byte[] bytes = new byte[20];
        random.nextBytes(bytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private boolean verifyTotp(String hexSecret, String codeToVerify) {
        try {
            byte[] key = new byte[hexSecret.length() / 2];
            for (int i = 0; i < key.length; i++) {
                key[i] = (byte) Integer.parseInt(hexSecret.substring(i * 2, i * 2 + 2), 16);
            }
            long currentTime = System.currentTimeMillis() / 30000;

            for (int i = -1; i <= 1; i++) {
                String calculated = generateTotpCode(key, currentTime + i);
                if (calculated.equals(codeToVerify)) {
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private String generateTotpCode(byte[] key, long timeWindow) throws Exception {
        byte[] data = new byte[8];
        for (int i = 7; i >= 0; i--) {
            data[i] = (byte) (timeWindow & 0xFF);
            timeWindow >>= 8;
        }

        javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA1");
        mac.init(new javax.crypto.spec.SecretKeySpec(key, "RAW"));
        byte[] hash = mac.doFinal(data);

        int offset = hash[hash.length - 1] & 0xF;
        int binary = ((hash[offset] & 0x7f) << 24) |
                ((hash[offset + 1] & 0xff) << 16) |
                ((hash[offset + 2] & 0xff) << 8) |
                (hash[offset + 3] & 0xff);

        int otp = binary % 1000000;
        return String.format("%06d", otp);
    }

    private void insertScanLog(Long orderId, Long scannerUserId, boolean isValid) {
        try {
            String result = isValid ? "SUCCESS" : "FAIL";
            jdbcTemplate.update(
                    "INSERT INTO scan_log (order_item_id, staff_user_id, scan_type, result, scanned_at) VALUES (?, ?, 'ENTRY_QR', ?, NOW())",
                    orderId, scannerUserId, result);
        } catch (Exception e) {
            System.err.println("Failed to insert scan_log: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    @PostMapping("/ticket")
    public Map<String, Object> createTicketOrder(@RequestBody Map<String, Object> payload) {
        int totalPrice = ((Number) payload.get("totalPrice")).intValue();
        List<String> seats = (List<String>) payload.get("seats"); // 텍스트 레이블 (표시용)
        List<Object> seatIdsRaw = (List<Object>) payload.get("seatIds"); // DB PK 배열 (예약 처리용)

        // seatIds가 있으면 PK 기반으로 정확하게 처리 (구역 혼동 없음)
        List<Long> seatIds = new ArrayList<>();
        if (seatIdsRaw != null) {
            for (Object idObj : seatIdsRaw) {
                try {
                    seatIds.add(((Number) idObj).longValue());
                } catch (Exception e) {
                    /* 무시 */ }
            }
        }

        // seat_ids 컬럼에는 PK 목록 저장 (조회 및 환불 처리에 활용)
        String seatIdsStr = seatIds.isEmpty()
                ? (seats != null ? String.join(", ", seats) : "")
                : seatIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(", "));

        // eventNo를 festival_id로 사용 (없으면 1 기본값)
        int festivalId = 1;
        if (payload.get("eventNo") != null) {
            try {
                festivalId = ((Number) payload.get("eventNo")).intValue();
            } catch (Exception e) {
                /* 무시 */ }
        }

        // QR 텍스트 데이터 및 고유 난수 생성
        String ticketNum = generateRandomTicketNumber();

        // userToken에서 userId 파싱 (정합성 추가)
        String userToken = (String) payload.get("userToken");
        Long userId = null;
        if (userToken != null) {
            if (userToken.startsWith("festio-jwt-token-")) {
                try {
                    userId = Long.parseLong(userToken.substring("festio-jwt-token-".length()));
                } catch (Exception e) {
                    // 무시
                }
            } else if (userToken.equals("festio-admin-jwt-token-7777")) {
                try {
                    userId = jdbcTemplate.queryForObject(
                            "SELECT id FROM app_user WHERE email = 'admin@gmail.com'", Long.class);
                } catch (Exception e) {
                    // 무시
                }
            }
        }

        // INSERT 후 생성된 orderId 반환
        String insertSql = "INSERT INTO orders (user_id, festival_id, total_price, payment_status, created_at, seat_ids, is_entered, ticket_type, ticket_number) "
                +
                "VALUES (?, ?, ?, 'PAID', NOW(), ?, false, 'ONSITE', ?) RETURNING id";

        Long orderId = jdbcTemplate.queryForObject(insertSql, Long.class, userId, festivalId, totalPrice, seatIdsStr,
                ticketNum);

        // 보안: TOTP 전용 비밀키 생성 후 저장
        String secret = generateHexSecret();
        String qrPayload = "SECRET:" + secret;
        jdbcTemplate.update("UPDATE orders SET qr_code = ? WHERE id = ?", qrPayload, orderId);

        // ★ 구역별 정확한 좌석 예약 처리 ★
        if (!seatIds.isEmpty()) {
            // seatIds(PK)가 있으면 ID로 정확히 업데이트 → 구역 혼동 없음
            for (Long seatId : seatIds) {
                try {
                    int updated = jdbcTemplate.update(
                            "UPDATE seat_map SET is_reserved = true WHERE id = ?", seatId);
                    if (updated == 0) {
                        System.err.println("좌석 예약 처리: id=" + seatId + " 에 해당하는 좌석 없음");
                    }
                } catch (Exception e) {
                    System.err.println("좌석 예약 실패 id=" + seatId + ": " + e.getMessage());
                }
            }
        } else if (seats != null) {
            // 하위 호환: seatIds 없을 때 기존 방식 (row+number 패턴)
            for (String seat : seats) {
                seat = seat.trim();
                if (!seat.contains("-"))
                    continue;
                String[] parts = seat.split("-", 2);
                try {
                    int number = Integer.parseInt(parts[1]);
                    jdbcTemplate.update(
                            "UPDATE seat_map SET is_reserved = true WHERE seat_row LIKE ? AND seat_number = ?",
                            parts[0] + "%", number);
                } catch (Exception e) {
                    System.err.println("좌석 예약 처리 실패: " + seat + " - " + e.getMessage());
                }
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("status", "success");
        res.put("orderId", orderId);
        res.put("ticketNumber", ticketNum);
        res.put("qrPayload", qrPayload);
        return res;
    }

    @GetMapping("/tickets/qr")
    public List<Map<String, Object>> getQrTickets(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        Long userId = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (token.startsWith("festio-jwt-token-")) {
                try {
                    userId = Long.parseLong(token.substring("festio-jwt-token-".length()));
                } catch (Exception e) {
                    // 무시
                }
            } else if (token.equals("festio-admin-jwt-token-7777")) {
                try {
                    userId = jdbcTemplate.queryForObject(
                            "SELECT id FROM app_user WHERE email = 'admin@gmail.com'", Long.class);
                } catch (Exception e) {
                    // 무시
                }
            }
        }

        String sql;
        List<Map<String, Object>> rows;
        if (userId != null) {
            sql = "SELECT o.id as order_id, o.qr_code, o.is_entered, o.seat_ids, o.ticket_number, o.created_at, o.total_price, f.name as event_name, f.start_date as event_date "
                    +
                    "FROM orders o " +
                    "LEFT JOIN festival f ON o.festival_id = f.id " +
                    "WHERE o.qr_code IS NOT NULL AND o.user_id = ? " +
                    "ORDER BY o.id DESC";
            rows = jdbcTemplate.queryForList(sql, userId);
        } else {
            sql = "SELECT o.id as order_id, o.qr_code, o.is_entered, o.seat_ids, o.ticket_number, o.created_at, o.total_price, f.name as event_name, f.start_date as event_date "
                    +
                    "FROM orders o " +
                    "LEFT JOIN festival f ON o.festival_id = f.id " +
                    "WHERE o.qr_code IS NOT NULL AND o.user_id IS NULL " +
                    "ORDER BY o.id DESC";
            rows = jdbcTemplate.queryForList(sql);
        }

        List<Map<String, Object>> result = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            Map<String, Object> map = new HashMap<>();
            map.put("orderId", row.get("order_id"));

            String qrCode = (String) row.get("qr_code");
            if (qrCode != null && qrCode.startsWith("SECRET:")) {
                map.put("secret", qrCode.substring(7));
            } else {
                map.put("secret", qrCode);
            }

            map.put("ticketNumber", row.get("ticket_number"));
            map.put("seats", row.get("seat_ids"));
            map.put("createdAt", row.get("created_at") != null ? row.get("created_at").toString() : "");
            map.put("totalPrice", row.get("total_price") != null ? ((Number) row.get("total_price")).intValue() : 0);
            map.put("eventName", row.get("event_name") != null ? row.get("event_name") : "페스티벌 예매 티켓");
            map.put("eventDate", row.get("event_date") != null ? row.get("event_date").toString() : "");

            Boolean isEntered = (Boolean) row.get("is_entered");
            if (isEntered != null && isEntered) {
                map.put("used", "true");
            }
            result.add(map);
        }
        return result;
    }

    @PostMapping("/tickets/scan")
    public Map<String, Object> scanQrTicket(@RequestBody Map<String, String> payload) {
        String qrText = payload.get("qrText"); // format: TOTP:15:123456
        Map<String, Object> res = new HashMap<>();

        if (qrText == null || !qrText.startsWith("TOTP:")) {
            insertScanLog(-1L, 1L, false); // 형식이 맞지 않는 스캔도 실패로 기록
            res.put("status", "INVALID");
            res.put("message", "올바른 동적(TOTP) 모바일 티켓 형식이 아닙니다.");
            return res;
        }

        String[] parts = qrText.split(":");
        if (parts.length != 3) {
            insertScanLog(-1L, 1L, false);
            res.put("status", "INVALID");
            res.put("message", "티켓 데이터가 손상되었습니다.");
            return res;
        }

        Long orderId;
        String totpCode = parts[2];
        try {
            orderId = Long.parseLong(parts[1]);
        } catch (Exception e) {
            insertScanLog(-1L, 1L, false);
            res.put("status", "INVALID");
            res.put("message", "주문 번호를 인식할 수 없습니다.");
            return res;
        }

        List<Map<String, Object>> orders = jdbcTemplate.queryForList(
                "SELECT id, seat_ids, is_entered, qr_code FROM orders WHERE id = ?", orderId);

        if (orders.isEmpty()) {
            insertScanLog(orderId, 1L, false);
            res.put("status", "INVALID");
            res.put("message", "존재하지 않는 주문이거나 올바르지 않은 티켓입니다.");
            return res;
        }

        Map<String, Object> order = orders.get(0);
        String savedSecret = (String) order.get("qr_code");
        if (savedSecret == null || !savedSecret.startsWith("SECRET:")) {
            insertScanLog(orderId, 1L, false);
            res.put("status", "INVALID");
            res.put("message", "구형 티켓입니다. 최신 TOTP 티켓을 발급받아주세요.");
            return res;
        }

        String hexSecret = savedSecret.substring(7);
        if (!verifyTotp(hexSecret, totpCode)) {
            insertScanLog(orderId, 1L, false);
            res.put("status", "INVALID");
            res.put("message", "시간이 초과되었거나 복사된 위조 티켓입니다. 앱을 열어 새로고침된 QR을 스캔해주세요.");
            return res;
        }
        String seats = (String) order.get("seat_ids");

        // 원자적 업데이트 (Atomic Update): is_entered가 false(또는 null)일 때만 true로 변경
        // 이렇게 하면 찰나의 순간에 2명의 스태프가 동시 스캔해도 1명만 성공(1)하고 다른 1명은 실패(0)하게 됩니다.
        int updatedRows = jdbcTemplate.update(
                "UPDATE orders SET is_entered = true WHERE id = ? AND (is_entered = false OR is_entered IS NULL)",
                orderId);

        if (updatedRows == 0) {
            insertScanLog(orderId, 1L, false); // 중복 스캔 (실패 로그)
            res.put("status", "ALREADY_ENTERED");
            res.put("message", "이미 입장 처리된 티켓입니다! (중복 입장 불가)");
            res.put("seats", seats);
            return res;
        }

        insertScanLog(orderId, 1L, true); // 정상 스캔 (성공 로그)

        res.put("status", "VALID");
        res.put("message", "유효성 검증 성공! 입장 처리되었습니다. (좌석: " + seats + ")");
        res.put("seats", seats);

        return res;
    }

    @PostMapping("/tickets/{id}/manual-enter")
    public Map<String, Object> manualEnterTicket(@PathVariable("id") Long id) {
        Map<String, Object> res = new HashMap<>();

        List<Map<String, Object>> orders = jdbcTemplate.queryForList(
                "SELECT id, seat_ids, is_entered FROM orders WHERE id = ?", id);

        if (orders.isEmpty()) {
            insertScanLog(id, 1L, false);
            res.put("status", "INVALID");
            res.put("message", "존재하지 않는 주문입니다.");
            return res;
        }

        Map<String, Object> order = orders.get(0);
        Boolean isEntered = (Boolean) order.get("is_entered");

        if (isEntered != null && isEntered) {
            insertScanLog(id, 1L, false);
            res.put("status", "ALREADY_ENTERED");
            res.put("message", "이미 입장 처리된 티켓입니다.");
            return res;
        }

        jdbcTemplate.update("UPDATE orders SET is_entered = true WHERE id = ?", id);
        insertScanLog(id, 1L, true);

        res.put("status", "VALID");
        res.put("message", "수동 입장 처리가 완료되었습니다.");

        return res;
    }

    @GetMapping("/tickets")
    public List<Map<String, Object>> getTicketOrders() {
        String sql = "SELECT id, total_price, payment_status, created_at, seat_ids, is_entered, ticket_number " +
                "FROM orders " +
                "WHERE seat_ids IS NOT NULL " +
                "ORDER BY created_at DESC";

        return jdbcTemplate.queryForList(sql);
    }

    @GetMapping("/scan-logs")
    public List<Map<String, Object>> getScanLogs() {
        String sql = "SELECT s.id, s.result, TO_CHAR(s.scanned_at, 'YYYY-MM-DD HH24:MI:SS') as scanned_at, " +
                "o.seat_ids, o.ticket_number, o.ticket_type " +
                "FROM scan_log s " +
                "LEFT JOIN orders o ON s.order_item_id = o.id " +
                "ORDER BY s.scanned_at DESC LIMIT 50";
        return jdbcTemplate.queryForList(sql);
    }

    @PutMapping("/tickets/{id}/status")
    public Map<String, String> updateTicketStatus(@PathVariable("id") Long id,
            @RequestBody Map<String, String> payload) {
        String nextStatus = payload.get("status");
        jdbcTemplate.update("UPDATE orders SET payment_status = ? WHERE id = ?", nextStatus, id);

        if ("REFUNDED".equals(nextStatus)) {
            // 환불 시 QR 데이터 초기화 및 좌석 반환
            try {
                jdbcTemplate.update("UPDATE orders SET qr_code = NULL WHERE id = ?", id);
                String seatIdsStr = jdbcTemplate.queryForObject(
                        "SELECT seat_ids FROM orders WHERE id = ?", String.class, id);
                if (seatIdsStr != null && !seatIdsStr.isEmpty()) {
                    String[] seats = seatIdsStr.split(",");
                    for (String s : seats) {
                        String seat = s.trim();
                        if (seat.contains("-")) {
                            String zone = seat.split("-")[0];
                            int number = Integer.parseInt(seat.split("-")[1]);
                            jdbcTemplate.update(
                                    "UPDATE seat_map SET is_reserved = false WHERE seat_row LIKE ? AND seat_number = ?",
                                    "%" + zone + "%", number);
                        }
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        Map<String, String> res = new HashMap<>();
        res.put("status", "success");
        return res;
    }
}
