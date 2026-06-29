package festival.payment.domain;

import festival.user.domain.UserVo;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "wallet_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WalletHistoryVo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_email", referencedColumnName = "email")
    private UserVo user;

    @Column(name = "transaction_type", nullable = false)
    private String transactionType; // CHARGE, PAY, REFUND

    @Column(name = "amount", nullable = false)
    private Integer amount;

    @Column(name = "current_balance", nullable = false)
    private Integer currentBalance;

    @Column(name = "description")
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
