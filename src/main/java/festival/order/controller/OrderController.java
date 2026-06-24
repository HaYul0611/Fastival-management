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
            sql = "SELECT oi.id as item_id, p.name as product_name, oi.quantity, p.price, oi.item_status, oi.updated_at, o.qr_code "
                    +
                    "FROM order_item oi " +
                    "JOIN product p ON oi.product_id = p.id " +
                    "JOIN orders o ON oi.order_id = o.id " +
                    "WHERE oi.product_type = 'FOOD' AND o.user_id = ? " +
                    "ORDER BY oi.updated_at DESC";
            rows = jdbcTemplate.queryForList(sql, userId);
        } else {
            rows = new ArrayList<>();
        }


        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> order = new HashMap<>();

            Long itemId = ((Number) row.get("item_id")).longValue();
            order.put("id", String.format("F%011d", itemId));
            order.put("type", "FOOD");
            order.put("totp_secret", row.get("qr_code") != null ? ((String) row.get("qr_code")).replace("SECRET:", "") : "dummysecret12345");

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

    @GetMapping("/debug/reset-password")
    public String resetPassword() {
        org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder encoder = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
        String realHash = encoder.encode("festio1234!");
        int rows = jdbcTemplate.update("UPDATE app_user SET password = ? WHERE email = 'gate_staff_8807@festio.com'", realHash);
        return "Password reset for " + rows + " users. New hash: " + realHash;
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

    @GetMapping("/notifications")
    public List<Map<String, Object>> getMyNotifications(
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
                } catch (Exception e) {}
            }
        }

        if (userId == null) {
            return new ArrayList<>();
        }

        String sql = "SELECT oi.id, p.name, oi.item_status, oi.updated_at " +
                     "FROM order_item oi " +
                     "JOIN product p ON oi.product_id = p.id " +
                     "JOIN orders o ON oi.order_id = o.id " +
                     "WHERE o.user_id = ? AND oi.item_status IN ('COOKING', 'READY', 'SERVED', 'SHIPPED') " +
                     "ORDER BY oi.updated_at DESC LIMIT 10";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, userId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> notif = new HashMap<>();
            notif.put("id", row.get("id"));
            notif.put("name", row.get("name"));
            notif.put("status", row.get("item_status"));
            notif.put("timestamp", row.get("updated_at") != null ? row.get("updated_at").toString() : "");
            result.add(notif);
        }
        return result;
    }

    @GetMapping("/shop/my")
    public List<Map<String, Object>> getMyShopOrders(
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
                } catch (Exception e) {}
            }
        }

        if (userId == null) {
            return new ArrayList<>();
        }

        String sql = "SELECT o.id as order_id, o.created_at, o.total_price, o.payment_status, o.qr_code, " +
                     "oi.id as item_id, oi.product_type, oi.quantity, oi.item_status, " +
                     "p.id as product_id, p.name as product_name, p.price as item_price, p.image_url " +
                     "FROM orders o " +
                     "LEFT JOIN order_item oi ON o.id = oi.order_id " +
                     "LEFT JOIN product p ON oi.product_id = p.id " +
                     "WHERE o.user_id = ? " +
                     "ORDER BY o.created_at DESC";

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, userId);
        Map<Long, Map<String, Object>> orderMap = new LinkedHashMap<>();

        for (Map<String, Object> row : rows) {
            Long orderId = ((Number) row.get("order_id")).longValue();
            if (!orderMap.containsKey(orderId)) {
                Map<String, Object> order = new HashMap<>();
                order.put("order_number", "O" + String.format("%011d", orderId));
                order.put("created_at", row.get("created_at") != null ? row.get("created_at").toString() : "");
                order.put("delivery_type", "PICKUP"); 
                order.put("payment_method", "FESTIO_PAY");
                order.put("total_amount", row.get("total_price"));
                order.put("totp_secret", row.get("qr_code") != null ? ((String) row.get("qr_code")).replace("SECRET:", "") : "dummysecret12345");

                String oStatus = (String) row.get("payment_status");
                order.put("status", oStatus);

                order.put("shop_order_items", new ArrayList<Map<String, Object>>());
                orderMap.put(orderId, order);
            }

            Map<String, Object> order = orderMap.get(orderId);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) order.get("shop_order_items");

            if (row.get("item_id") != null) {
                Map<String, Object> item = new HashMap<>();
                item.put("product_id", row.get("product_id"));
                item.put("product_name", row.get("product_name"));
                item.put("quantity", row.get("quantity"));
                item.put("price_at_purchase", row.get("item_price"));
                
                String pType = (String) row.get("product_type");
                Map<String, Object> sp = new HashMap<>();
                sp.put("type", pType);
                sp.put("thumbnail_image_url", row.get("image_url"));
                item.put("shop_products", sp);

                items.add(item);
                
                String iStatus = (String) row.get("item_status");
                if ("READY".equals(iStatus) || "COMPLETED".equals(iStatus) || "SERVED".equals(iStatus)) {
                    order.put("status", "READY_FOR_PICKUP");
                }
                
                if ("GOODS".equals(pType)) {
                    order.put("order_number", "G" + String.format("%011d", orderId));
                } else if ("FOOD".equals(pType) && !order.get("order_number").toString().startsWith("G")) {
                    order.put("order_number", "F" + String.format("%011d", orderId));
                }
            }
        }

        return new ArrayList<>(orderMap.values());
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
    public List<Map<String, Object>> getAllSeats(
            @RequestParam(value = "zones", required = false) String zonesParam,
            @RequestParam(value = "festivalId", required = false) Long festivalId) {
            
        String sql;
        List<Map<String, Object>> rows;

        if (festivalId != null) {
            // festivalId가 있을 때는 zone_name을 zone 식별자로 사용
            sql = "SELECT fz.zone_name as zone, s.seat_number, s.seat_row, s.is_reserved, s.price " +
                  "FROM seat_map s " +
                  "JOIN festival_zone fz ON s.zone_id = fz.id " +
                  "WHERE fz.festival_id = ? " +
                  "ORDER BY fz.zone_name, s.seat_row, s.seat_number";
            rows = jdbcTemplate.queryForList(sql, festivalId);
        } else {
            sql = "SELECT SUBSTRING(s.seat_row, 1, 1) as zone, s.seat_number, s.seat_row, s.is_reserved, s.price " +
                  "FROM seat_map s ";
                  
            if (zonesParam != null && !zonesParam.isEmpty()) {
                List<String> zonesList = Arrays.asList(zonesParam.split(","));
                String inSql = String.join(",", Collections.nCopies(zonesList.size(), "?"));
                sql += "WHERE SUBSTRING(s.seat_row, 1, 1) IN (" + inSql + ") ";
                sql += "ORDER BY zone, s.seat_number";
                rows = jdbcTemplate.queryForList(sql, zonesList.toArray());
            } else {
                sql += "ORDER BY zone, s.seat_number";
                rows = jdbcTemplate.queryForList(sql);
            }
        }

        String orderSql = "SELECT seat_ids, is_entered FROM orders WHERE payment_status = 'PAID' AND seat_ids IS NOT NULL";
        List<Map<String, Object>> activeOrders;
        if (festivalId != null) {
            orderSql += " AND festival_id = ?";
            activeOrders = jdbcTemplate.queryForList(orderSql, festivalId);
        } else {
            activeOrders = jdbcTemplate.queryForList(orderSql);
        }

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
        Set<String> processedSeatIds = new HashSet<>();

        for (Map<String, Object> row : rows) {
            Map<String, Object> seat = new HashMap<>();
            String zone = (String) row.get("zone");
            Number number = (Number) row.get("seat_number");
            String seatRow = (String) row.get("seat_row");
            
            // seatRow가 1열, 2열과 같을 수 있으므로 포함해서 유니크 ID 구성
            String seatId = zone + "-" + seatRow + "_" + number;
            
            // 예전 결제 내역(orders 테이블)에 저장된 형태 (예: A-1) 추적용 로직
            String legacySeatId = "";
            if (seatRow != null && seatRow.length() > 0) {
                String rowLetter = seatRow.replaceAll("[^a-zA-Z]", "");
                if (rowLetter.isEmpty()) {
                    rowLetter = String.valueOf(seatRow.charAt(0));
                }
                legacySeatId = rowLetter + "-" + number;
            }

            // ui.js의 기존 로직 파손 방지 (기존 A-1 형태도 허용되게끔)
            if (festivalId == null) {
                seatId = legacySeatId;
            }

            Boolean dbIsReserved = (Boolean) row.get("is_reserved");
            if (dbIsReserved == null) dbIsReserved = false;

            boolean isReservedByOrder = reservedSeats.contains(seatId) || reservedSeats.contains(legacySeatId);
            boolean isEnteredByOrder = enteredSeats.contains(seatId) || enteredSeats.contains(legacySeatId);

            seat.put("id", seatId);
            seat.put("zone", zone);
            seat.put("seatRow", seatRow);
            seat.put("number", number);
            seat.put("price", row.get("price"));
            seat.put("isReserved", dbIsReserved || isReservedByOrder);
            seat.put("isEntered", isEnteredByOrder);
            allSeats.add(seat);
            
            processedSeatIds.add(seatId);
            processedSeatIds.add(legacySeatId);
        }

        // DB(seat_map)에는 없는 '가상/동적 구역(F3, F4 등)'에 예약된 좌석도 화면에 반영하기 위해 추가
        for (String rs : reservedSeats) {
            if (!processedSeatIds.contains(rs)) {
                Map<String, Object> virtualSeat = new HashMap<>();
                virtualSeat.put("id", rs);
                virtualSeat.put("isReserved", true);
                virtualSeat.put("isEntered", enteredSeats.contains(rs));
                allSeats.add(virtualSeat);
            }
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
            long currentTime = System.currentTimeMillis() / 180000;

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

        long otp = binary % 2176782336L;
        String code = Long.toString(otp, 36).toUpperCase();
        while (code.length() < 6) {
            code = "0" + code;
        }
        return code;
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

        int festivalId = 1;
        if (payload.get("eventNo") != null) {
            try {
                festivalId = Integer.parseInt(payload.get("eventNo").toString());
            } catch (Exception e) {
                /* 무시 */ }
        }

        // [실시간 런타임 축제 시작 시각 비교 및 예매 차단 검증]
        try {
            Map<String, Object> festivalInfo = jdbcTemplate.queryForMap(
                "SELECT start_date, start_time, name FROM festival WHERE id = ?", festivalId);
            if (festivalInfo != null) {
                java.sql.Date startDateSql = (java.sql.Date) festivalInfo.get("start_date");
                String startTimeSql = (String) festivalInfo.get("start_time");
                String festivalName = (String) festivalInfo.get("name");
                
                if (startDateSql != null) {
                    java.time.LocalDate startDate = startDateSql.toLocalDate();
                    String timeStr = (startTimeSql == null || startTimeSql.trim().isEmpty()) ? "00:00:00" : startTimeSql.trim();
                    if (timeStr.length() == 5) timeStr += ":00";
                    
                    java.time.LocalTime startTime = java.time.LocalTime.parse(timeStr);
                    java.time.LocalDateTime festivalStartDateTime = java.time.LocalDateTime.of(startDate, startTime);
                    
                    if (java.time.LocalDateTime.now().isAfter(festivalStartDateTime) || java.time.LocalDateTime.now().isEqual(festivalStartDateTime)) {
                        Map<String, Object> errRes = new HashMap<>();
                        errRes.put("status", "fail");
                        errRes.put("message", "'" + festivalName + "' 행사가 이미 시작되어 더 이상 예매를 진행할 수 없습니다.");
                        return errRes;
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Festival time check validation skipped or failed: " + e.getMessage());
        }

        // QR 텍스트 데이터 및 고유 난수 생성
        String ticketNum = generateRandomTicketNumber();

        // userToken에서 userId 파싱 (정합성 추가)
        String userToken = (String) payload.get("userToken");
        String userId = null;
        if (userToken != null) {
            if (userToken.startsWith("festio-jwt-token-")) {
                userId = userToken.substring("festio-jwt-token-".length());
            } else if (userToken.equals("festio-admin-jwt-token-7777")) {
                try {
                    userId = jdbcTemplate.queryForObject(
                            "SELECT id FROM app_user WHERE email = 'admin@gmail.com'", String.class);
                } catch (Exception e) {
                    // 무시
                }
            }
        }


        // INSERT 후 생성된 orderId 반환 (KeyHolder 사용으로 호환성 확보)
        String insertSql = "INSERT INTO orders (user_id, festival_id, total_price, payment_status, created_at, seat_ids, is_entered, ticket_type, ticket_number) "
                +
                "VALUES (?, ?, ?, 'PAID', NOW(), ?, false, 'ONSITE', ?)";

        final String finalUserId = userId;
        final int finalFestivalId = festivalId;
        
        org.springframework.jdbc.support.KeyHolder keyHolder = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            java.sql.PreparedStatement ps = connection.prepareStatement(insertSql, new String[] { "id" });
            ps.setString(1, finalUserId);
            ps.setInt(2, finalFestivalId);
            ps.setInt(3, totalPrice);
            ps.setString(4, seatIdsStr);
            ps.setString(5, ticketNum);
            return ps;
        }, keyHolder);
        
        Long orderId = keyHolder.getKey() != null ? keyHolder.getKey().longValue() : 0L;

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
            // 하위 호환: seatIds 없을 때 기존 방식 (row+number 패턴) 및 새 방식 (zone-row_number 패턴)
            for (String seat : seats) {
                seat = seat.trim();
                try {
                    if (seat.contains("_")) {
                        // 새 포맷: zone-F1-A_3
                        int lastUnderscore = seat.lastIndexOf('_');
                        int number = Integer.parseInt(seat.substring(lastUnderscore + 1));
                        
                        String beforeUnderscore = seat.substring(0, lastUnderscore); // zone-F1-A
                        int lastDash = beforeUnderscore.lastIndexOf('-');
                        String rowPart = beforeUnderscore.substring(lastDash + 1); // A
                        String zonePart = beforeUnderscore.substring(0, lastDash); // zone-F1
                        
                        jdbcTemplate.update(
                                "UPDATE seat_map SET is_reserved = true " +
                                "WHERE seat_row = ? AND seat_number = ? AND zone_id IN " +
                                "(SELECT id FROM festival_zone WHERE zone_name = ? AND festival_id = ?)",
                                rowPart, number, zonePart, festivalId);
                    } else if (seat.contains("-")) {
                        // 예전 포맷: A-1
                        String[] parts = seat.split("-", 2);
                        int number = Integer.parseInt(parts[1]);
                        jdbcTemplate.update(
                                "UPDATE seat_map SET is_reserved = true WHERE seat_row LIKE ? AND seat_number = ?",
                                parts[0] + "%", number);
                    } else {
                        // FREE 모드 또는 좌석명이 단순 zoneName인 경우 (예: "일반 입장권")
                        // 해당 zone의 빈 좌석 중 하나를 임의로 예약 처리하여 실제 수량을 차감시킵니다.
                        try {
                            List<Long> availableSeatIds = jdbcTemplate.queryForList(
                                "SELECT id FROM seat_map WHERE zone_id IN " +
                                "(SELECT id FROM festival_zone WHERE zone_name = ? AND festival_id = ?) " +
                                "AND is_reserved = false LIMIT 1",
                                Long.class, seat, festivalId);
                            if (!availableSeatIds.isEmpty()) {
                                jdbcTemplate.update("UPDATE seat_map SET is_reserved = true WHERE id = ?", availableSeatIds.get(0));
                            }
                        } catch (Exception e) {
                            System.err.println("FREE 모드 좌석 차감 실패: " + seat + " - " + e.getMessage());
                        }
                    }
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

    @PostMapping("/shop")
    public Map<String, Object> createShopOrder(@RequestBody Map<String, Object> payload) {
        int totalPrice = ((Number) payload.get("totalPrice")).intValue();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) payload.get("items");

        // festivalId 기본값 설정
        int festivalId = 1;
        if (payload.get("festivalId") != null) {
            try { festivalId = Integer.parseInt(payload.get("festivalId").toString()); } catch (Exception e) {}
        }

        // 유저 파싱
        String userToken = (String) payload.get("userToken");
        String userId = null;
        if (userToken != null && userToken.startsWith("festio-jwt-token-")) {
            userId = userToken.substring("festio-jwt-token-".length());
        }

        // orders 테이블 인서트 (샵 주문은 티켓 번호나 구역이 필요하지 않으므로 임의의 값 삽입)
        String ticketNum = "S" + System.currentTimeMillis();
        String secret = generateHexSecret();
        String qrPayload = "SECRET:" + secret;
        
        String orderSql = "INSERT INTO orders (user_id, festival_id, total_price, payment_status, created_at, is_entered, ticket_type, ticket_number, qr_code) VALUES (?, ?, ?, 'PAID', NOW(), false, 'SHOP', ?, ?)";
        
        final String finalUserId = userId;
        final int finalFestivalId = festivalId;

        org.springframework.jdbc.support.KeyHolder keyHolder = new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            java.sql.PreparedStatement ps = connection.prepareStatement(orderSql, new String[] { "id" });
            ps.setString(1, finalUserId);
            ps.setInt(2, finalFestivalId);
            ps.setInt(3, totalPrice);
            ps.setString(4, ticketNum);
            ps.setString(5, qrPayload);
            return ps;
        }, keyHolder);
        
        Long orderId = keyHolder.getKey() != null ? keyHolder.getKey().longValue() : 0L;

        // order_item 테이블 인서트
        if (items != null) {
            for (Map<String, Object> item : items) {
                Long productId = ((Number) item.get("id")).longValue();
                int qty = ((Number) item.get("qty")).intValue();
                String type = (String) item.get("type"); // 'FOOD', 'GOODS'
                if (type == null) type = "GOODS";
                
                String options = (String) item.get("options");

                String itemSql = "INSERT INTO order_item (order_id, product_id, product_type, quantity, item_status, selected_options, updated_at) " +
                                 "VALUES (?, ?, ?, ?, 'ORDERED', ?, NOW())";
                jdbcTemplate.update(itemSql, orderId, productId, type, qty, options);
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("orderId", orderId);
        res.put("qrPayload", qrPayload);
        return res;
    }


    @GetMapping("/tickets/qr")
    public List<Map<String, Object>> getQrTickets(
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
            sql = "SELECT o.id as order_id, o.festival_id, o.qr_code, o.is_entered, o.seat_ids, o.ticket_number, o.created_at, o.total_price, f.name as event_name, f.start_date as event_date "
                    +
                    "FROM orders o " +
                    "LEFT JOIN festival f ON o.festival_id = f.id " +
                    "WHERE o.qr_code IS NOT NULL AND o.user_id = ? " +
                    "ORDER BY o.id DESC";
            rows = jdbcTemplate.queryForList(sql, userId);
        } else {
            // 비로그인 상태일 때는 빈 리스트를 반환하여 현장 예매 내역이 임의 유저에게 노출되지 않도록 함
            rows = new ArrayList<>();
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
            map.put("festivalId", row.get("festival_id"));
            map.put("festival_id", row.get("festival_id"));

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
        Map<String, Object> res = new HashMap<>();
        String qrText = payload.get("qrText"); // format: e.g. TXXXXXX... (12 chars)

        if (qrText == null || qrText.length() != 12) {
            insertScanLog(-1L, 1L, false);
            res.put("status", "INVALID");
            res.put("message", "올바른 동적 바코드 형식이 아닙니다.");
            return res;
        }

        Long orderId;
        String totpCode;
        try {
            String base36 = qrText.substring(1);
            long obf = Long.parseLong(base36, 36);
            long combined = obf ^ 90000000000000000L; // MASK_DYNAMIC
            orderId = combined / 1000000L;
            long totpNum = combined % 1000000L;
            totpCode = String.format("%06d", totpNum);
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
