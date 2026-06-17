package festival.festival.service;

import festival.festival.domain.SeatMap;
import festival.festival.repository.SeatMapRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SeatMapService {

    private final SeatMapRepository seatMapRepository;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    /**
     * 특정 구역(zoneId)에 속한 모든 좌석을 행/열 순서대로 정렬하여 조회합니다.
     */
    public List<SeatMap> getSeatsByZone(Long zoneId) {
        return seatMapRepository.findByZoneIdOrderBySeatRowAscSeatNumberAsc(zoneId);
    }

    /**
     * 특정 구역에 좌석 격자판 데이터를 대량 생성합니다. (기존 좌석은 삭제 후 재생성)
     */
    @Transactional
    public void generateSeats(Long zoneId, int rowCount, int colCount, int price) {
        // 기존 구역 좌석 데이터 일괄 삭제
        seatMapRepository.deleteByZoneId(zoneId);

        List<SeatMap> seatsToSave = new ArrayList<>();

        for (int r = 0; r < rowCount; r++) {
            String seatRow = getRowLabel(r);
            for (int c = 1; c <= colCount; c++) {
                SeatMap seat = SeatMap.builder()
                        .zoneId(zoneId)
                        .seatRow(seatRow)
                        .seatNumber(c)
                        .price(price)
                        .status("빈자리")
                        .isReserved(false)
                        .version(0L)
                        .build();
                seatsToSave.add(seat);
            }
        }

        seatMapRepository.saveAll(seatsToSave);
    }

    /**
     * 변경된 좌석 레이아웃(status, price)을 데이터베이스에 반영합니다.
     */
    @Transactional
    public void updateLayout(List<Map<String, Object>> layoutUpdates) {
        for (Map<String, Object> update : layoutUpdates) {
            Long seatId = Long.valueOf(update.get("id").toString());
            String newStatus = update.get("status").toString();

            SeatMap seat = seatMapRepository.findById(seatId)
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 좌석 ID입니다: " + seatId));

            seat.setStatus(newStatus);

            // 개별 가격(price) 속성이 페일로드에 있는 경우 반영
            if (update.containsKey("price")) {
                seat.setPrice(Integer.parseInt(update.get("price").toString()));
            }

            // '무대'나 '통로'인 경우 사용자가 예매하지 못하도록 예약 상태(isReserved)를 TRUE 처리
            if ("무대".equals(newStatus) || "통로".equals(newStatus)) {
                seat.setIsReserved(true);
            } else {
                seat.setIsReserved(false);
            }
            seatMapRepository.save(seat);
        }
    }

    /**
     * 숫자를 엑셀 스타일 알파벳(A, B, C ... Z, AA, AB ...) '열' 문자열로 변환합니다.
     */
    private String getRowLabel(int index) {
        StringBuilder label = new StringBuilder();
        int temp = index;
        while (temp >= 0) {
            label.insert(0, (char) ('A' + (temp % 26)));
            temp = (temp / 26) - 1;
        }
        return label.toString();
    }

    /**
     * 특정 좌석에 대한 예약 완료(PAID)된 실제 구매자 정보를 orders 및 app_user 테이블 조회를 통해 가져옵니다.
     */
    public java.util.Map<String, Object> getReservationInfo(Long seatId) {
        SeatMap seat = seatMapRepository.findById(seatId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 좌석 ID입니다: " + seatId));

        java.util.Map<String, Object> result = new java.util.HashMap<>();
        result.put("seatName", seat.getSeatRow() + " " + seat.getSeatNumber() + "번");
        result.put("status", "NONE");

        // 만약 예약(isReserved) 상태가 아니거나 무대/통로이면 예매 정보가 없으므로 바로 반환
        if (!seat.getIsReserved() || "무대".equals(seat.getStatus()) || "통로".equals(seat.getStatus())) {
            return result;
        }

        // seatRow의 첫 글자 알파벳과 seatNumber의 조합 (예: 'A-3')
        String rowLetter = seat.getSeatRow().replaceAll("[^a-zA-Z]", "");
        if (rowLetter.isEmpty() && seat.getSeatRow().length() > 0) {
            rowLetter = String.valueOf(seat.getSeatRow().charAt(0));
        }
        String seatPattern = "%" + rowLetter + "-" + seat.getSeatNumber() + "%";

        String sql = "SELECT o.id, o.created_at, o.payment_status, u.email, u.name, u.phone " +
                     "FROM orders o " +
                     "LEFT JOIN app_user u ON o.user_id = u.id " +
                     "WHERE o.seat_ids LIKE ? AND o.payment_status = 'PAID' " +
                     "ORDER BY o.created_at DESC LIMIT 1";

        try {
            java.util.List<java.util.Map<String, Object>> rows = jdbcTemplate.queryForList(sql, seatPattern);
            if (!rows.isEmpty()) {
                java.util.Map<String, Object> row = rows.get(0);
                result.put("status", row.get("payment_status"));
                result.put("orderId", row.get("id"));
                result.put("createdAt", row.get("created_at") != null ? row.get("created_at").toString() : "");
                result.put("customerEmail", row.get("email") != null ? row.get("email").toString() : "N/A");
                result.put("customerName", row.get("name") != null ? row.get("name").toString() : "N/A");
                result.put("customerPhone", row.get("phone") != null ? row.get("phone").toString() : "N/A");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return result;
    }

    /**
     * 특정 좌석의 행명(seatRow) 및 좌석번호(seatNumber)를 개별 수정하여 특이 레이아웃 네이밍을 지원합니다.
     */
    @Transactional
    public void updateSeatLabel(Long seatId, String seatRow, int seatNumber) {
        SeatMap seat = seatMapRepository.findById(seatId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 좌석 ID입니다: " + seatId));

        if (seatRow == null || seatRow.trim().isEmpty() || seatRow.length() > 10) {
            throw new IllegalArgumentException("좌석 행(Row)은 1~10자 이내여야 합니다.");
        }
        if (seatNumber <= 0) {
            throw new IllegalArgumentException("좌석 번호는 1 이상이어야 합니다.");
        }

        seat.setSeatRow(seatRow.trim());
        seat.setSeatNumber(seatNumber);
        seatMapRepository.save(seat);
    }

    /**
     * 특정 구역과 해당 구역에 매핑된 모든 좌석을 안전하게 트랜잭션 범위 내에서 일괄 삭제합니다.
     */
    @Transactional
    public void deleteZoneWithSeats(Long zoneId) {
        // 1. 해당 구역의 모든 좌석 삭제
        seatMapRepository.deleteByZoneId(zoneId);
        // 2. 구역 자체 삭제
        jdbcTemplate.update("DELETE FROM festival_zone WHERE id = ?", zoneId);
    }

    /**
     * DB 내의 모든 좌석 정보를 디버깅용으로 반환합니다.
     */
    public List<SeatMap> getAllSeats() {
        return seatMapRepository.findAll();
    }

    /**
     * DB 내의 깨진 좌석 행 데이터를 복구하여 알파벳만 남깁니다.
     */
    @Transactional
    public void fixSeatRows() {
        List<SeatMap> seats = seatMapRepository.findAll();
        for (SeatMap seat : seats) {
            if (seat.getSeatRow() != null) {
                String cleaned = seat.getSeatRow().replaceAll("[^a-zA-Z]", "");
                if (!cleaned.equals(seat.getSeatRow()) && !cleaned.isEmpty()) {
                    seat.setSeatRow(cleaned);
                    seatMapRepository.save(seat);
                }
            }
        }
    }
}
