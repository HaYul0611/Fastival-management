package festival.festival.controller;

import festival.festival.domain.Festival;
import festival.festival.service.FestivalService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * Festival 도메인의 REST API 컨트롤러 클래스입니다.
 * 프론트엔드 화면과 실제 Supabase PostgreSQL DB를 유기적으로 동기화합니다.
 */
@RestController
@RequestMapping("/api/festival")
@RequiredArgsConstructor
public class FestivalController {

    private final FestivalService festivalService;
    private final festival.festival.service.SeatMapService seatMapService;

    /**
     * 전체 페스티벌 마스터 목록을 최신 순서로 조회합니다.
     * GET /api/festival
     */
    @GetMapping
    public ResponseEntity<List<Festival>> getAllFestivals() {
        return ResponseEntity.ok(festivalService.getAllFestivals());
    }

    /**
     * 새로운 페스티벌을 등록합니다.
     * POST /api/festival
     */
    @PostMapping
    public ResponseEntity<Festival> createFestival(@RequestBody Festival festival) {
        Festival savedFestival = festivalService.createFestival(festival);
        return ResponseEntity.ok(savedFestival);
    }

    /**
     * 특정 페스티벌의 활성화 상태(is_active)를 토글합니다.
     * PUT /api/festival/{id}/toggle
     */
    @PutMapping("/{id}/toggle")
    public ResponseEntity<Festival> toggleActive(@PathVariable("id") Long id) {
        Festival updatedFestival = festivalService.toggleActive(id);
        return ResponseEntity.ok(updatedFestival);
    }

    /**
     * 특정 페스티벌 마스터 데이터를 DB에서 영구 삭제합니다.
     * DELETE /api/festival/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFestival(@PathVariable("id") Long id) {
        festivalService.deleteFestival(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * 특정 페스티벌의 심사 상태 및 운영 단계를 변경합니다.
     * PATCH /api/festival/{id}/status
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<Festival> updateStatus(
             @PathVariable("id") Long id,
             @RequestBody java.util.Map<String, String> statusMap) {
        String reviewStatus = statusMap.get("reviewStatus");
        String operationalStatus = statusMap.get("operationalStatus");
        Festival updatedFestival = festivalService.updateStatus(id, reviewStatus, operationalStatus);
        return ResponseEntity.ok(updatedFestival);
    }

    /**
     * 특정 구역(zoneId)에 속한 모든 좌석 데이터를 조회합니다 (일반 사용자용 비보안 API).
     * GET /api/festival/seats
     */
    @GetMapping("/seats")
    public ResponseEntity<List<festival.festival.domain.SeatMap>> getSeatsByZone(@RequestParam("zoneId") Long zoneId) {
        return ResponseEntity.ok(seatMapService.getSeatsByZone(zoneId));
    }


    /**
     * 특정 페스티벌 단건 마스터 데이터를 조회합니다.
     * GET /api/festival/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<Festival> getFestivalById(@PathVariable("id") Long id) {
        return festivalService.getFestival(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * 특정 페스티벌에 속한 구역 목록을 조회합니다.
     * GET /api/festival/{id}/zones
     */
    @GetMapping("/{id}/zones")
    public ResponseEntity<List<festival.festival.domain.FestivalZone>> getZonesByFestival(@PathVariable("id") Long id) {
        List<festival.festival.domain.FestivalZone> zones = festivalService.getZonesByFestival(id);
        List<festival.festival.domain.FestivalZone> allowedZones = zones.stream()
                .filter(z -> !"DISABLED".equalsIgnoreCase(z.getStatus()))
                .toList();
        return ResponseEntity.ok(allowedZones);
    }

    /**
     * 행사 상세 페이지의 탭 HTML 내용(공지사항, 상품설명, 환불규정 등)을 저장합니다.
     * 관리자가 프론트엔드 빌더에서 편집 후 저장 버튼을 누르면 이 API가 호출됩니다.
     * PUT /api/festival/{id}/description
     */
    @PutMapping("/{id}/description")
    public ResponseEntity<Festival> updateDescription(
            @PathVariable("id") Long id,
            @RequestBody java.util.Map<String, String> body) {
        String descriptionHtml = body.get("descriptionHtml");
        Festival updatedFestival = festivalService.updateDescriptionHtml(id, descriptionHtml);
        return ResponseEntity.ok(updatedFestival);
    }
}
