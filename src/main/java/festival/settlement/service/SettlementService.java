package festival.settlement.service;

import festival.settlement.domain.SettlementVo.FestivalDto;
import festival.settlement.domain.SettlementVo.StoreSettlementDto;
import festival.settlement.domain.SettlementVo.SettlementSummaryDto;
import festival.settlement.domain.SettlementVo.StoreProductSalesDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Settlement 도메인의 비즈니스 로직을 처리하는 서비스입니다.
 */
@Service
public class SettlementService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 페스티벌 목록을 조회합니다.
     */
    public List<FestivalDto> getFestivals() {
        try {
            String sql = "SELECT id, name, operational_status FROM festival ORDER BY created_at DESC";
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
            List<FestivalDto> list = new ArrayList<>();

            for (Map<String, Object> row : rows) {
                list.add(FestivalDto.builder()
                        .id(((Number) row.get("id")).longValue())
                        .name((String) row.get("name"))
                        .operationalStatus((String) row.get("operational_status"))
                        .build());
            }
            return list;
        } catch (Exception e) {
            System.err.println("[SettlementService] getFestivals 에러 발생: " + e.getMessage());
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    /**
     * 데이터베이스 스키마 및 데이터를 상세 분석하여 원인을 진단합니다.
     */
    public Map<String, Object> diagnoseDatabase(Long festivalId) {
        Map<String, Object> diag = new HashMap<>();
        try {
            List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'store'"
            );
            diag.put("storeTableColumns", columns);

            List<Map<String, Object>> storeStats = jdbcTemplate.queryForList(
                "SELECT festival_id, COUNT(*) AS cnt FROM store GROUP BY festival_id"
            );
            diag.put("storeFestivalIdGroupStats", storeStats);

            List<Map<String, Object>> zoneStats = jdbcTemplate.queryForList(
                "SELECT z.festival_id, COUNT(s.id) AS cnt FROM store s " +
                "JOIN festival_zone z ON s.zone_id = z.id GROUP BY z.festival_id"
            );
            diag.put("storeZoneFestivalIdGroupStats", zoneStats);
        } catch (Exception e) {
            diag.put("error", e.getMessage());
        }
        return diag;
    }

    /**
     * 특정 페스티벌의 가맹점별 정산 통계를 집계합니다. (지급 완료 영속화 상태값 Join 연동)
     */
    public SettlementSummaryDto getSettlementSummary(Long festivalId) {
        List<StoreSettlementDto> stores = new ArrayList<>();
        long totalSalesSum = 0;
        long totalCommissionSum = 0;
        int completedCount = 0;

        try {
            boolean hasFestivalIdColumn = false;
            boolean hasBoothNumberColumn = false;

            List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'store'"
            );
            for (Map<String, Object> col : columns) {
                String name = (String) col.get("column_name");
                if ("festival_id".equalsIgnoreCase(name)) hasFestivalIdColumn = true;
                if ("booth_number".equalsIgnoreCase(name)) hasBoothNumberColumn = true;
            }

            String sql;
            String settlementMonthStr = "FEST_" + festivalId;
            Object[] params = new Object[]{ settlementMonthStr, festivalId };

            String storeSelectField = "s.id AS store_id, s.name AS store_name";
            if (hasBoothNumberColumn) {
                storeSelectField += ", s.booth_number AS booth_number";
            } else {
                storeSelectField += ", '' AS booth_number";
            }

            // settlement 테이블을 LEFT JOIN하여 실제 지급 여부와 지급 승인일자를 취득합니다.
            if (hasFestivalIdColumn) {
                sql = "SELECT " + storeSelectField + ", COALESCE(SUM(oi.quantity * p.price), 0) AS total_sales, " +
                      "       st.status AS settlement_status, st.updated_at AS settlement_date " +
                      "FROM store s " +
                      "LEFT JOIN settlement st ON st.store_id = s.id AND st.settlement_month = ? " +
                      "LEFT JOIN product p ON p.store_id = s.id " +
                      "LEFT JOIN order_item oi ON oi.product_id = p.id " +
                      "LEFT JOIN orders o ON oi.order_id = o.id AND o.payment_status = 'PAID' " +
                      "WHERE s.festival_id = ? " +
                      "GROUP BY s.id, s.name, st.status, st.updated_at" + (hasBoothNumberColumn ? ", s.booth_number" : "") + " " +
                      "ORDER BY total_sales DESC";
            } else {
                sql = "SELECT " + storeSelectField + ", COALESCE(SUM(oi.quantity * p.price), 0) AS total_sales, " +
                      "       st.status AS settlement_status, st.updated_at AS settlement_date " +
                      "FROM store s " +
                      "JOIN festival_zone z ON s.zone_id = z.id " +
                      "LEFT JOIN settlement st ON st.store_id = s.id AND st.settlement_month = ? " +
                      "LEFT JOIN product p ON p.store_id = s.id " +
                      "LEFT JOIN order_item oi ON oi.product_id = p.id " +
                      "LEFT JOIN orders o ON oi.order_id = o.id AND o.payment_status = 'PAID' " +
                      "WHERE z.festival_id = ? " +
                      "GROUP BY s.id, s.name, st.status, st.updated_at" + (hasBoothNumberColumn ? ", s.booth_number" : "") + " " +
                      "ORDER BY total_sales DESC";
            }

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params);

            for (Map<String, Object> row : rows) {
                long totalSales = row.get("total_sales") != null ? ((Number) row.get("total_sales")).longValue() : 0L;
                long pgFee = (long) (totalSales * 0.03); 
                long platformFee = (long) (totalSales * 0.05);
                long settlementAmount = totalSales - pgFee - platformFee;

                // DB에 기록된 상태가 있으면 해당 값을 쓰고, 없으면 매출액이 0보다 큰 경우에만 '지급대기', 0원이면 '-'로 표시합니다.
                String dbStatus = (String) row.get("settlement_status");
                String status = "지급대기";
                if (dbStatus != null) {
                    status = dbStatus;
                } else if (totalSales == 0) {
                    status = "-";
                }

                if ("지급완료".equals(status)) {
                    completedCount++;
                }

                String sDate = "-";
                if (row.get("settlement_date") != null) {
                    sDate = row.get("settlement_date").toString().substring(0, 10);
                }

                stores.add(StoreSettlementDto.builder()
                        .storeId(((Number) row.get("store_id")).longValue())
                        .storeName((String) row.get("store_name"))
                        .boothNumber((String) row.get("booth_number"))
                        .totalSales(totalSales)
                        .pgFee(pgFee)
                        .platformFee(platformFee)
                        .settlementAmount(settlementAmount)
                        .status(status)
                        .settlementDate(sDate)
                        .build());

                totalSalesSum += totalSales;
                totalCommissionSum += (pgFee + platformFee);
            }

        } catch (Exception e) {
            System.err.println("[SettlementService] getSettlementSummary 에러 발생: " + e.getMessage());
            e.printStackTrace();
        }

        // 정산 완료율 계산
        String completionRate = "0%";
        if (!stores.isEmpty()) {
            int activeStores = 0;
            for (StoreSettlementDto store : stores) {
                if (store.getTotalSales() > 0) {
                    activeStores++;
                }
            }
            if (activeStores > 0) {
                int rate = (int) (((double) completedCount / activeStores) * 100);
                completionRate = "정산 완료 (" + rate + "%)";
            } else {
                completionRate = "정산 완료 (100%)";
            }
        }

        return SettlementSummaryDto.builder()
                .totalSales(totalSalesSum)
                .totalCommission(totalCommissionSum)
                .completionRate(completionRate)
                .stores(stores)
                .build();
    }

    /**
     * 특정 가맹점의 정산금을 최종 지급 승인(지급 완료) 처리합니다.
     */
    @Transactional
    public boolean processPayout(Long storeId, Long festivalId, Long totalSales, Long commissionFee, Long finalPayout) {
        try {
            String settlementMonth = "FEST_" + festivalId;
            String countSql = "SELECT COUNT(*) FROM settlement WHERE store_id = ? AND settlement_month = ?";
            Integer count = jdbcTemplate.queryForObject(countSql, Integer.class, storeId, settlementMonth);

            if (count != null && count > 0) {
                String updateSql = "UPDATE settlement SET total_sales_amount = ?, commission_fee = ?, " +
                                   "final_payout_amount = ?, status = '지급완료', updated_at = NOW() " +
                                   "WHERE store_id = ? AND settlement_month = ?";
                jdbcTemplate.update(updateSql, totalSales, commissionFee, finalPayout, storeId, settlementMonth);
            } else {
                String insertSql = "INSERT INTO settlement (store_id, settlement_month, total_sales_amount, " +
                                   "commission_fee, final_payout_amount, status, updated_at) " +
                                   "VALUES (?, ?, ?, ?, ?, '지급완료', NOW())";
                jdbcTemplate.update(insertSql, storeId, settlementMonth, totalSales, commissionFee, finalPayout);
            }
            return true;
        } catch (Exception e) {
            System.err.println("[SettlementService] processPayout 에러 발생: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    /**
     * 특정 가맹점의 상품별 상세 판매 건수 및 매출 리스트를 조회합니다. (드릴다운 팝업용)
     */
    public List<StoreProductSalesDto> getStoreSalesDetails(Long storeId, Long festivalId) {
        List<StoreProductSalesDto> list = new ArrayList<>();
        try {
            String sql = "SELECT p.name AS product_name, p.price AS price, " +
                         "       COALESCE(SUM(oi.quantity), 0) AS total_quantity, " +
                         "       COALESCE(SUM(oi.quantity * p.price), 0) AS total_amount " +
                         "FROM order_item oi " +
                         "JOIN product p ON oi.product_id = p.id " +
                         "JOIN orders o ON oi.order_id = o.id " +
                         "WHERE p.store_id = ? AND o.festival_id = ? AND o.payment_status = 'PAID' " +
                         "GROUP BY p.id, p.name, p.price " +
                         "ORDER BY total_quantity DESC";
            
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, storeId, festivalId);
            for (Map<String, Object> row : rows) {
                list.add(StoreProductSalesDto.builder()
                        .productName((String) row.get("product_name"))
                        .price(((Number) row.get("price")).intValue())
                        .totalQuantity(((Number) row.get("total_quantity")).intValue())
                        .totalAmount(((Number) row.get("total_amount")).longValue())
                        .build());
            }
        } catch (Exception e) {
            System.err.println("[SettlementService] getStoreSalesDetails 에러 발생: " + e.getMessage());
            e.printStackTrace();
        }
        return list;
    }
}
