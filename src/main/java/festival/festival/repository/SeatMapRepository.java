package festival.festival.repository;

import festival.festival.domain.SeatMap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SeatMapRepository extends JpaRepository<SeatMap, Long> {
    List<SeatMap> findByZoneIdOrderBySeatRowAscSeatNumberAsc(Long zoneId);
    void deleteByZoneId(Long zoneId);
    boolean existsByZoneId(Long zoneId);
}
