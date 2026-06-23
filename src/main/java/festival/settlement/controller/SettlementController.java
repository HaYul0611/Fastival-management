package festival.settlement.controller;

import festival.settlement.domain.SettlementVo.FestivalDto;
import festival.settlement.domain.SettlementVo.SettlementSummaryDto;
import festival.settlement.domain.SettlementVo.StoreProductSalesDto;
import festival.settlement.service.SettlementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Settlement 도메인의 API 컨트롤러입니다.
 */
@RestController
@RequestMapping("/api/settlement")
public class SettlementController {

    @Autowired
    private SettlementService settlementService;

    /**
     * 정산용 페스티벌 목록을 조회합니다.
     */
    @GetMapping("/festivals")
    public ResponseEntity<List<FestivalDto>> getFestivals() {
        List<FestivalDto> festivals = settlementService.getFestivals();
        return ResponseEntity.ok(festivals);
    }

    /**
     * 특정 페스티벌의 가맹점 정산 요약 및 목록을 조회합니다.
     */
    @GetMapping("/summary")
    public ResponseEntity<SettlementSummaryDto> getSettlementSummary(@RequestParam("festivalId") Long festivalId) {
        SettlementSummaryDto summary = settlementService.getSettlementSummary(festivalId);
        return ResponseEntity.ok(summary);
    }

    /**
     * 가맹점 및 정산 데이터 스키마 진단 API
     */
    @GetMapping("/diagnose")
    public ResponseEntity<Map<String, Object>> diagnose(@RequestParam("festivalId") Long festivalId) {
        Map<String, Object> diagnosisResult = settlementService.diagnoseDatabase(festivalId);
        return ResponseEntity.ok(diagnosisResult);
    }

    /**
     * 특정 가맹점의 정산 지급 승인 처리 API
     */
    @PostMapping("/payout")
    public ResponseEntity<Map<String, Object>> payout(@RequestBody Map<String, Object> payload) {
        try {
            Long storeId = ((Number) payload.get("storeId")).longValue();
            Long festivalId = ((Number) payload.get("festivalId")).longValue();
            Long totalSales = ((Number) payload.get("totalSales")).longValue();
            Long commissionFee = ((Number) payload.get("commissionFee")).longValue();
            Long finalPayout = ((Number) payload.get("finalPayout")).longValue();

            boolean success = settlementService.processPayout(storeId, festivalId, totalSales, commissionFee, finalPayout);
            if (success) {
                return ResponseEntity.ok(Map.of("success", true, "message", "정산 지급 완료 처리가 성공적으로 실행되었습니다."));
            } else {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "지급 처리 과정에서 데이터베이스 에러가 발생했습니다."));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "인자 포맷 오류: " + e.getMessage()));
        }
    }

    /**
     * 특정 가맹점의 세부 판매 매출 분석 (드릴다운) API
     */
    @GetMapping("/store-details")
    public ResponseEntity<List<StoreProductSalesDto>> getStoreDetails(
            @RequestParam("storeId") Long storeId,
            @RequestParam("festivalId") Long festivalId) {
        List<StoreProductSalesDto> details = settlementService.getStoreSalesDetails(storeId, festivalId);
        return ResponseEntity.ok(details);
    }
}
