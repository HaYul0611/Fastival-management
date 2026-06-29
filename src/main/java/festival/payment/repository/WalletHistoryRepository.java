package festival.payment.repository;

import festival.payment.domain.WalletHistoryVo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WalletHistoryRepository extends JpaRepository<WalletHistoryVo, Long> {

    @Query("SELECT SUM(w.amount) FROM WalletHistoryVo w WHERE w.transactionType = :transactionType")
    Long sumAmountByTransactionType(@Param("transactionType") String transactionType);

    List<WalletHistoryVo> findAllByOrderByCreatedAtDesc();
}
