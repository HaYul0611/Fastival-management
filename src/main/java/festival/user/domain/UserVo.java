package festival.user.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_user")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserVo {

    @Id
    private String id;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 20)
    private String phone;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "ROLE_USER";

    @Column(name = "membership_grade", nullable = false, length = 20)
    @Builder.Default
    private String membershipGrade = "BRONZE";

    @Column(nullable = false)
    @Builder.Default
    private Integer balance = 0;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE"; // "ACTIVE" or "BANNED"

    @Column(name = "store_id")
    private Long storeId;

    @Column(name = "face_vector", columnDefinition = "TEXT")
    private String faceVector;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "withdrawn_at")
    private LocalDateTime withdrawnAt;

    @PrePersist
    protected void onCreate() {
        if (this.id == null) {
            this.id = java.util.UUID.randomUUID().toString();
        }
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        if (this.role == null) {
            this.role = "ROLE_USER";
        }
        if (this.membershipGrade == null) {
            this.membershipGrade = "BRONZE";
        }
        if (this.balance == null) {
            this.balance = 0;
        }
        if (this.status == null) {
            this.status = "ACTIVE";
        }
    }
}
