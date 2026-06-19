package festival.festival.controller;

import festival.festival.domain.Festival;
import festival.festival.domain.FestivalZone;
import festival.festival.domain.SeatMap;
import festival.festival.service.FestivalService;
import festival.festival.repository.FestivalRepository;
import festival.festival.repository.FestivalZoneRepository;
import festival.festival.repository.SeatMapRepository;
import festival.festival.service.SeatMapService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminSeatApiController {

    private final FestivalService festivalService;
    private final FestivalRepository festivalRepository;
    private final FestivalZoneRepository festivalZoneRepository;
    private final SeatMapRepository seatMapRepository;
    private final SeatMapService seatMapService;

    /**
     * 1. 등록된 모든 축제 목록 조회 (id, name 중심)
     * GET /api/admin/festivals
     */
    @GetMapping("/festivals")
    public ResponseEntity<List<Festival>> getFestivals() {
        List<Festival> festivals = festivalService.getAllFestivals();
        return ResponseEntity.ok(festivals);
    }

    /**
     * 1-2. 축제 정보 최종 발행 (status 및 상세 정보 일괄 업데이트)
     * PATCH /api/admin/festivals/{id}/publish
     */
    @PatchMapping("/festivals/{id}/publish")
    public ResponseEntity<?> publishFestival(
            @PathVariable("id") Long id,
            @RequestBody Map<String, Object> payload) {
        
        Festival festival = festivalRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 페스티벌 ID입니다: " + id));

        if (payload.containsKey("price")) {
            festival.setMinPrice(Long.parseLong(payload.get("price").toString()));
        }
        if (payload.containsKey("posterUrl")) {
            festival.setThumbnailUrl(payload.get("posterUrl").toString());
        }
        if (payload.containsKey("description")) {
            festival.setDescriptionHtml(payload.get("description").toString());
        }
        if (payload.containsKey("operationalStatus")) {
            festival.setOperationalStatus(payload.get("operationalStatus").toString());
        }
        if (payload.containsKey("isActive")) {
            festival.setIsActive(Boolean.parseBoolean(payload.get("isActive").toString()));
        }
        if (payload.containsKey("ticketMode")) {
            festival.setTicketMode(payload.get("ticketMode").toString());
        }

        Festival saved = festivalRepository.save(festival);
        return ResponseEntity.ok(saved);
    }

    /**
     * 2. 특정 축제에 종속된 구역 목록 조회
     * GET /api/admin/festivals/{festivalId}/zones
     */
    @GetMapping("/festivals/{festivalId}/zones")
    public ResponseEntity<List<Map<String, Object>>> getZonesByFestival(@PathVariable("festivalId") Long festivalId) {
        List<FestivalZone> zones = festivalZoneRepository.findByFestivalId(festivalId);
        List<Map<String, Object>> result = zones.stream().map(zone -> {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", zone.getId());
            map.put("festivalId", zone.getFestivalId());
            map.put("zoneName", zone.getZoneName());
            map.put("svgPoints", zone.getSvgPoints());
            map.put("safetyLimit", zone.getSafetyLimit());
            map.put("currentCrowdCount", zone.getCurrentCrowdCount());
            map.put("densityLevel", zone.getDensityLevel());
            map.put("status", zone.getStatus());
            map.put("mapBgUrl", zone.getMapBgUrl());
            map.put("hasSeats", seatMapRepository.existsByZoneId(zone.getId()));
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }

    /**
     * 3. 가변 좌석 격자 생성 (Bulk Insert)
     * POST /api/admin/seats/generate
     */
    @PostMapping("/seats/generate")
    public ResponseEntity<Map<String, Object>> generateSeats(@RequestBody Map<String, Object> payload) {
        Long zoneId = Long.valueOf(payload.get("zoneId").toString());
        int rowCount = Integer.parseInt(payload.get("rowCount").toString());
        int colCount = Integer.parseInt(payload.get("colCount").toString());
        int price = Integer.parseInt(payload.get("price").toString());

        seatMapService.generateSeats(zoneId, rowCount, colCount, price);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "좌석 판이 성공적으로 생성되었습니다.");
        return ResponseEntity.ok(response);
    }

    /**
     * 4. 특정 구역의 좌석 목록 조회
     * GET /api/admin/seats
     */
    @GetMapping("/seats")
    public ResponseEntity<List<SeatMap>> getSeats(@RequestParam("zoneId") Long zoneId) {
        List<SeatMap> seats = seatMapService.getSeatsByZone(zoneId);
        return ResponseEntity.ok(seats);
    }

    /**
     * 5. 시각적 좌석 레이아웃 편집기 상태 저장
     * PUT /api/admin/seats/layout
     */
    @PutMapping("/seats/layout")
    public ResponseEntity<Map<String, Object>> updateLayout(@RequestBody List<Map<String, Object>> layoutUpdates) {
        seatMapService.updateLayout(layoutUpdates);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "좌석 레이아웃 설정이 저장되었습니다.");
        return ResponseEntity.ok(response);
    }

    /**
     * 6. 특정 축제에 구역 신규 생성
     * POST /api/admin/festivals/{festivalId}/zones
     */
    @PostMapping("/festivals/{festivalId}/zones")
    public ResponseEntity<FestivalZone> createZone(
            @PathVariable("festivalId") Long festivalId,
            @RequestBody Map<String, Object> payload) {

        Festival festival = festivalRepository.findById(festivalId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 페스티벌 ID입니다: " + festivalId));

        FestivalZone zone = new FestivalZone();
        zone.setFestivalId(festival.getId());
        zone.setZoneName(payload.get("zoneName").toString());
        zone.setSvgPoints(payload.getOrDefault("svgPoints", "0,0").toString());
        zone.setSafetyLimit(Integer.parseInt(payload.getOrDefault("safetyLimit", "500").toString()));
        if (payload.containsKey("mapBgUrl") && payload.get("mapBgUrl") != null) {
            zone.setMapBgUrl(payload.get("mapBgUrl").toString());
        }
        zone.setCurrentCrowdCount(0);
        zone.setDensityLevel("여유");
        zone.setStatus("NORMAL");

        FestivalZone saved = festivalZoneRepository.save(zone);
        return ResponseEntity.ok(saved);
     }

    /**
     * 신규 구역 생성 (경로 매핑 호환용)
     * POST /api/admin/zones
     */
    @PostMapping("/zones")
    public ResponseEntity<FestivalZone> createZoneDirect(@RequestBody Map<String, Object> payload) {
        Long festivalId = Long.valueOf(payload.get("festivalId").toString());
        Festival festival = festivalRepository.findById(festivalId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 페스티벌 ID입니다: " + festivalId));

        FestivalZone zone = new FestivalZone();
        zone.setFestivalId(festival.getId());
        zone.setZoneName(payload.get("zoneName").toString());
        zone.setSvgPoints(payload.getOrDefault("svgPoints", "0,0").toString());
        zone.setSafetyLimit(Integer.parseInt(payload.getOrDefault("safetyLimit", "500").toString()));
        if (payload.containsKey("mapBgUrl") && payload.get("mapBgUrl") != null) {
            zone.setMapBgUrl(payload.get("mapBgUrl").toString());
        }
        zone.setCurrentCrowdCount(0);
        zone.setDensityLevel("여유");
        zone.setStatus("NORMAL");

        FestivalZone saved = festivalZoneRepository.save(zone);
        return ResponseEntity.ok(saved);
    }

    /**
     * 구역 SVG 좌표 업데이트 (드래그 위치 변경 대응)
     * PUT /api/admin/zones/{zoneId}/points
     */
    @PutMapping("/zones/{zoneId}/points")
    public ResponseEntity<FestivalZone> updateZonePoints(
            @PathVariable("zoneId") Long zoneId,
            @RequestBody Map<String, Object> payload) {
        
        FestivalZone zone = festivalZoneRepository.findById(zoneId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 구역 ID입니다: " + zoneId));
        
        zone.setSvgPoints(payload.get("svgPoints").toString());
        FestivalZone updated = festivalZoneRepository.save(zone);
        return ResponseEntity.ok(updated);
    }

    /**
     * 구역 기본 정보 업데이트 (이름 및 수용 인원 수정)
     * PUT /api/admin/zones/{zoneId}
     */
    @PutMapping("/zones/{zoneId}")
    public ResponseEntity<FestivalZone> updateZoneInfo(
            @PathVariable("zoneId") Long zoneId,
            @RequestBody Map<String, Object> payload) {
        
        FestivalZone zone = festivalZoneRepository.findById(zoneId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 구역 ID입니다: " + zoneId));
        
        if (payload.containsKey("zoneName")) {
            zone.setZoneName(payload.get("zoneName").toString());
        }
        if (payload.containsKey("safetyLimit")) {
            zone.setSafetyLimit(Integer.parseInt(payload.get("safetyLimit").toString()));
        }
        
        FestivalZone updated = festivalZoneRepository.save(zone);
        return ResponseEntity.ok(updated);
    }

    /**
     * 구역 활성화 상태 토글 (허용/미허용)
     * PUT /api/admin/zones/{zoneId}/toggle-status
     */
    @PutMapping("/zones/{zoneId}/toggle-status")
    public ResponseEntity<FestivalZone> toggleZoneStatus(@PathVariable("zoneId") Long zoneId) {
        FestivalZone zone = festivalZoneRepository.findById(zoneId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 구역 ID입니다: " + zoneId));
        
        if ("DISABLED".equalsIgnoreCase(zone.getStatus())) {
            zone.setStatus("NORMAL");
        } else {
            zone.setStatus("DISABLED");
        }
        
        FestivalZone updated = festivalZoneRepository.save(zone);
        return ResponseEntity.ok(updated);
    }

    /**
     * 7. 특정 좌석의 상세 예매 정보 조회 (관제 대시보드 용)
     * GET /api/admin/seats/{seatId}/reservation
     */
    @GetMapping("/seats/{seatId}/reservation")
    public ResponseEntity<Map<String, Object>> getReservationInfo(@PathVariable("seatId") Long seatId) {
        Map<String, Object> info = seatMapService.getReservationInfo(seatId);
        return ResponseEntity.ok(info);
    }

    /**
     * 8. 좌석 행/번호 개별 커스텀 라벨 수정
     * PUT /api/admin/seats/{seatId}/label
     */
    @PutMapping("/seats/{seatId}/label")
    public ResponseEntity<Map<String, Object>> updateSeatLabel(
            @PathVariable("seatId") Long seatId,
            @RequestBody Map<String, Object> payload) {
        
        String seatRow = payload.get("seatRow").toString();
        int seatNumber = Integer.parseInt(payload.get("seatNumber").toString());
        
        seatMapService.updateSeatLabel(seatId, seatRow, seatNumber);
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "좌석 라벨이 성공적으로 변경되었습니다.");
        return ResponseEntity.ok(response);
    }

    /**
     * 9. 특정 구역 및 하위 좌석 일괄 삭제
     * DELETE /api/admin/zones/{zoneId}
     */
    @DeleteMapping("/zones/{zoneId}")
    public ResponseEntity<Map<String, Object>> deleteZone(@PathVariable("zoneId") Long zoneId) {
        seatMapService.deleteZoneWithSeats(zoneId);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "구역과 좌석이 성공적으로 삭제되었습니다.");
        return ResponseEntity.ok(response);
    }

    /**
     * 구역 배경 이미지 업로드
     * POST /api/admin/zones/{zoneId}/background
     */
    @PostMapping("/zones/{zoneId}/background")
    public ResponseEntity<Map<String, Object>> uploadBackground(
            @PathVariable("zoneId") Long zoneId,
            @RequestParam("file") MultipartFile file) {

        FestivalZone zone = festivalZoneRepository.findById(zoneId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 구역 ID입니다: " + zoneId));

        if (file.isEmpty()) {
            throw new IllegalArgumentException("업로드할 파일이 비어 있습니다.");
        }

        try {
            // 프로젝트 루트 아래의 uploads 폴더 경로 획득
            Path uploadDir = Paths.get("uploads");
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }

            // 고유 파일 이름 생성 (기존 파일 덮어쓰기 방지 및 이름 표준화)
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String filename = "zone_" + zoneId + "_" + System.currentTimeMillis() + extension;
            Path filePath = uploadDir.resolve(filename);

            // 파일 저장 (톰캣 임시 디렉토리 상대 경로 버그 방지를 위해 Files.copy 사용)
            Files.copy(file.getInputStream(), filePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

            // 웹 접근 경로 설정 및 DB 반영
            String fileUrl = "/uploads/" + filename;
            zone.setMapBgUrl(fileUrl);
            festivalZoneRepository.save(zone);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("fileUrl", fileUrl);
            response.put("message", "배경 이미지가 성공적으로 업로드되었습니다.");
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            throw new RuntimeException("파일 저장 중 오류가 발생했습니다: " + e.getMessage(), e);
        }
    }

    /**
     * 구역 배경 이미지 삭제
     * DELETE /api/admin/zones/{zoneId}/background
     */
    @DeleteMapping("/zones/{zoneId}/background")
    public ResponseEntity<Map<String, Object>> deleteBackground(@PathVariable("zoneId") Long zoneId) {
        FestivalZone zone = festivalZoneRepository.findById(zoneId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 구역 ID입니다: " + zoneId));

        zone.setMapBgUrl(null);
        festivalZoneRepository.save(zone);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "배경 이미지가 제거되었습니다.");
        return ResponseEntity.ok(response);
    }
}
