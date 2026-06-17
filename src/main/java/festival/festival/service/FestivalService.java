package festival.festival.service;

import festival.festival.domain.Festival;
import festival.festival.repository.FestivalRepository;
import festival.festival.repository.FestivalZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

/**
 * Festival 도메인의 비즈니스 로직을 처리하는 서비스 클래스입니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FestivalService {

    private final FestivalRepository festivalRepository;
    private final FestivalZoneRepository festivalZoneRepository;

    /**
     * 모든 페스티벌 목록을 조회합니다. 최신 등록 순서대로 조회됩니다.
     */
    public List<Festival> getAllFestivals() {
        return festivalRepository.findAllByOrderByIdDesc();
    }

    /**
     * 신규 페스티벌을 등록합니다.
     */
    @Transactional
    public Festival createFestival(Festival festival) {
        return festivalRepository.save(festival);
    }

    /**
     * 특정 페스티벌의 활성화 상태(is_active)를 토글합니다.
     */
    @Transactional
    public Festival toggleActive(Long id) {
        Festival festival = festivalRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 페스티벌 ID입니다: " + id));
        festival.setIsActive(!festival.getIsActive());
        return festival;
    }

    /**
     * 특정 페스티벌 데이터를 영구적으로 삭제합니다.
     * 외래 키 제약 조건(FK) 충돌을 미연에 방지하기 위해 관련 자식 테이블 데이터를 순차적으로 먼저 정돈합니다.
     */
    @Transactional
    public void deleteFestival(Long id) {
        if (!festivalRepository.existsById(id)) {
            throw new IllegalArgumentException("존재하지 않는 페스티벌 ID입니다: " + id);
        }
        
        festivalRepository.deleteReviewsByFestivalId(id);
        festivalRepository.deleteWishlistsByFestivalId(id);
        festivalRepository.deleteOrdersByFestivalId(id);
        festivalRepository.deleteFestivalZonesByFestivalId(id);
        
        festivalRepository.deleteById(id);
    }

    /**
     * 특정 페스티벌의 심사 상태 및 운영 단계를 변경합니다.
     */
    @Transactional
    public Festival updateStatus(Long id, String reviewStatus, String operationalStatus) {
        Festival festival = festivalRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 페스티벌 ID입니다: " + id));
        if (reviewStatus != null) {
            festival.setReviewStatus(reviewStatus);
        }
        if (operationalStatus != null) {
            festival.setOperationalStatus(operationalStatus);
        }
        return festival;
    }

    /**
     * 특정 페스티벌 정보를 ID로 단건 조회합니다.
     */
    public java.util.Optional<Festival> getFestival(Long id) {
        return festivalRepository.findById(id);
    }

    /**
     * 특정 페스티벌에 매핑된 구역(Zone) 목록을 조회합니다.
     */
    public List<festival.festival.domain.FestivalZone> getZonesByFestival(Long festivalId) {
        return festivalZoneRepository.findByFestivalId(festivalId);
    }

    /**
     * 행사 상세 페이지의 탭 HTML 내용을 DB에 저장합니다.
     * 관리자 페이지에서 편집한 공지사항, 상품설명, 환불규정 등의 HTML 구조가 저장됩니다.
     */
    @Transactional
    public Festival updateDescriptionHtml(Long id, String descriptionHtml) {
        Festival festival = festivalRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 페스티벌 ID입니다: " + id));
        festival.setDescriptionHtml(descriptionHtml);
        return festival;
    }
}
