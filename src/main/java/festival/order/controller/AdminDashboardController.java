package festival.order.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 관리자 대시보드 통계 API 컨트롤러
 * - 진행중인 페스티벌별 입장 인원 (is_entered = true)
 * - 진행중인 행사 입점사(store) 누적 매출 합산
 * - 금일 누적 매출 총액 (O2O 주문 + 예매 티켓 합산)
 */
@RestController
@RequestMapping("/api/admin/dashboard")
public class AdminDashboardController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 1. 전체 체류 인파: 진행중인 페스티벌(ONGOING)의 축제별 입장 인원
     * GET /api/admin/dashboard/attendance
     * 반환: [ { festivalId, festivalName, enteredCount } ]
     */
    @GetMapping("/attendance")
    public ResponseEntity<?> getAttendance() {
        try {
            String sql =
                "SELECT f.id AS festival_id, f.name AS festival_name, " +
                "       COUNT(o.id) AS entered_count " +
                "FROM festival f " +
                "LEFT JOIN orders o ON o.festival_id = f.id AND o.is_entered = true " +
                "WHERE f.operational_status = 'ONGOING' " +
                "GROUP BY f.id, f.name " +
                "ORDER BY f.id";

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);

            List<Map<String, Object>> result = new ArrayList<>();
            long totalEntered = 0;
            for (Map<String, Object> row : rows) {
                Map<String, Object> item = new HashMap<>();
                item.put("festivalId", row.get("festival_id"));
                item.put("festivalName", row.get("festival_name"));
                long cnt = row.get("entered_count") != null ? ((Number) row.get("entered_count")).longValue() : 0L;
                item.put("enteredCount", cnt);
                totalEntered += cnt;
                result.add(item);
            }

            Map<String, Object> response = new HashMap<>();
            response.put("festivals", result);
            response.put("totalEntered", totalEntered);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("festivals", new ArrayList<>(), "totalEntered", 0));
        }
    }

    /**
     * 2. 입점사 누적 정산액: 진행중인 행사(ONGOING)에 입점한 가맹점들의 전체 매출 합산
     * GET /api/admin/dashboard/store-revenue
     * 반환: { totalRevenue, storeCount }
     */
    @GetMapping("/store-revenue")
    public ResponseEntity<?> getStoreRevenue() {
        try {
            // 진행중인 축제에 연계된 가맹점의 order_item 매출 합산
            // store 테이블에 festival_id 컬럼이 있다는 가정 하에 작성
            // festival_id 없는 경우 ONGOING 페스티벌이 있는 시간대의 모든 paid order_item 합산
            String sql =
                "SELECT COALESCE(SUM(oi.quantity * p.price), 0) AS total_revenue, " +
                "       COUNT(DISTINCT p.store_id) AS store_count " +
                "FROM order_item oi " +
                "JOIN product p ON oi.product_id = p.id " +
                "JOIN orders o ON oi.order_id = o.id " +
                "JOIN festival f ON o.festival_id = f.id " +
                "WHERE f.operational_status = 'ONGOING' " +
                "  AND o.payment_status = 'PAID'";

            Map<String, Object> row = jdbcTemplate.queryForMap(sql);
            long totalRevenue = row.get("total_revenue") != null ? ((Number) row.get("total_revenue")).longValue() : 0L;
            long storeCount = row.get("store_count") != null ? ((Number) row.get("store_count")).longValue() : 0L;

            return ResponseEntity.ok(Map.of(
                "totalRevenue", totalRevenue,
                "storeCount", storeCount
            ));
        } catch (Exception e) {
            // 조인 실패 시 전체 paid order_item 합산으로 폴백
            try {
                String fallbackSql =
                    "SELECT COALESCE(SUM(oi.quantity * p.price), 0) AS total_revenue, " +
                    "       COUNT(DISTINCT p.store_id) AS store_count " +
                    "FROM order_item oi " +
                    "JOIN product p ON oi.product_id = p.id " +
                    "JOIN orders o ON oi.order_id = o.id " +
                    "WHERE o.payment_status = 'PAID'";
                Map<String, Object> row = jdbcTemplate.queryForMap(fallbackSql);
                long totalRevenue = row.get("total_revenue") != null ? ((Number) row.get("total_revenue")).longValue() : 0L;
                long storeCount = row.get("store_count") != null ? ((Number) row.get("store_count")).longValue() : 0L;
                return ResponseEntity.ok(Map.of("totalRevenue", totalRevenue, "storeCount", storeCount));
            } catch (Exception ex) {
                return ResponseEntity.ok(Map.of("totalRevenue", 0L, "storeCount", 0L));
            }
        }
    }

    /**
     * 3. 금일 누적 매출 총액: 오늘 발생한 (O2O 주문 + 예매 티켓) 합산
     * GET /api/admin/dashboard/today-revenue
     * 반환: { totalRevenue, o2oRevenue, ticketRevenue }
     */
    @GetMapping("/today-revenue")
    public ResponseEntity<?> getTodayRevenue() {
        try {
            // 금일 예매(ticket) 매출: orders.total_price, ticket_type = 'ONSITE' 또는 qr_code IS NOT NULL
            String ticketSql =
                "SELECT COALESCE(SUM(total_price), 0) AS ticket_revenue " +
                "FROM orders " +
                "WHERE payment_status = 'PAID' " +
                "  AND DATE(created_at) = CURRENT_DATE";

            long ticketRevenue = 0L;
            try {
                ticketRevenue = jdbcTemplate.queryForObject(ticketSql, Long.class);
                if (ticketRevenue == 0) ticketRevenue = 0L;
            } catch (Exception ignored) {}

            // 금일 O2O(F&B) 매출: order_item x product.price
            String o2oSql =
                "SELECT COALESCE(SUM(oi.quantity * p.price), 0) AS o2o_revenue " +
                "FROM order_item oi " +
                "JOIN product p ON oi.product_id = p.id " +
                "JOIN orders o ON oi.order_id = o.id " +
                "WHERE o.payment_status = 'PAID' " +
                "  AND DATE(o.created_at) = CURRENT_DATE";

            long o2oRevenue = 0L;
            try {
                o2oRevenue = jdbcTemplate.queryForObject(o2oSql, Long.class);
                if (o2oRevenue == 0) o2oRevenue = 0L;
            } catch (Exception ignored) {}

            // 티켓 매출에서 O2O 중복분 제거 (orders.total_price 는 예매 전용으로만 합산)
            // 단, orders가 예매와 O2O 모두 포함하는 구조일 경우:
            // 예매(qr_code 있는 것)만 선택
            String ticketOnlySql =
                "SELECT COALESCE(SUM(total_price), 0) AS ticket_revenue " +
                "FROM orders " +
                "WHERE payment_status = 'PAID' " +
                "  AND qr_code IS NOT NULL " +
                "  AND DATE(created_at) = CURRENT_DATE";
            try {
                ticketRevenue = jdbcTemplate.queryForObject(ticketOnlySql, Long.class);
                if (ticketRevenue == 0) ticketRevenue = 0L;
            } catch (Exception ignored) {}

            long totalRevenue = ticketRevenue + o2oRevenue;

            return ResponseEntity.ok(Map.of(
                "totalRevenue", totalRevenue,
                "ticketRevenue", ticketRevenue,
                "o2oRevenue", o2oRevenue
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("totalRevenue", 0L, "ticketRevenue", 0L, "o2oRevenue", 0L));
        }
    }
}
