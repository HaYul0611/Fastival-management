package festival.settlement.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

/**
 * Settlement 도메인의 엔티티 및 DTO 객체입니다.
 */
public class SettlementVo {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FestivalDto {
        private Long id;
        private String name;
        private String operationalStatus;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StoreSettlementDto {
        private Long storeId;
        private String storeName;
        private String boothNumber;
        private long totalSales;
        private long pgFee;
        private long platformFee;
        private long settlementAmount;
        private String status;
        private String settlementDate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SettlementSummaryDto {
        private long totalSales;
        private long totalCommission;
        private String completionRate;
        private List<StoreSettlementDto> stores;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StoreProductSalesDto {
        private String productName;
        private int price;
        private int totalQuantity;
        private long totalAmount;
    }
}
