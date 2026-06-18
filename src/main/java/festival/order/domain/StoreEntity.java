package festival.order.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "store")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StoreEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "zone_id")
    private Long zoneId;

    @Column(name = "festival_id")
    private Long festivalId;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "category", nullable = false, length = 20)
    private String category;

    @Column(name = "operating_hours", length = 100)
    private String operatingHours;

    @Column(name = "map_x_percent")
    private Double mapXPercent;

    @Column(name = "map_y_percent")
    private Double mapYPercent;

    @Column(name = "is_open")
    @Builder.Default
    private Boolean isOpen = true;

    @Column(name = "booth_number", length = 50)
    private String boothNumber;

    @Column(name = "notice", length = 255)
    private String notice;

    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
