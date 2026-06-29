package festival.user.repository;

import festival.user.domain.UserVo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<UserVo, String> {
    Optional<UserVo> findByEmail(String email);

    Optional<UserVo> findByStoreId(Long storeId);

    boolean existsByEmail(String email);
    List<UserVo> findByStatusAndWithdrawnAtBefore(String status, LocalDateTime withdrawnAt);

    @org.springframework.data.jpa.repository.Query("SELECT SUM(u.balance) FROM UserVo u WHERE u.status = 'ACTIVE'")
    Long sumAllActiveUserBalances();
}
