package festival.payment.repository;

import festival.payment.domain.WalletHistoryVo;
import festival.user.domain.UserVo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WalletHistoryRepository extends JpaRepository<WalletHistoryVo, Long> {

    List<WalletHistoryVo> findAllByOrderByCreatedAtDesc();

    List<WalletHistoryVo> findByUserOrderByCreatedAtDesc(UserVo user);

    @Query("SELECT SUM(w.amount) FROM WalletHistoryVo w WHERE w.transactionType = :type")
    Long sumAmountByTransactionType(@Param("type") String type);
}
