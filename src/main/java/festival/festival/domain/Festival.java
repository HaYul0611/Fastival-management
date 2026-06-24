package festival.festival.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Festival 도메인의 JPA 엔티티 객체입니다.
 * Supabase의 festival 테이블 명세와 100% 매칭됩니다.
 */
@Entity
@Table(name = "festival")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Festival {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "map_image_url", columnDefinition = "TEXT")
    private String mapImageUrl;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = true, length = 100)
    private String category; // '콘서트/뮤지컬', '지역축제', '대학축제', '박람회', '스포츠'
    @Column(nullable = true, length = 255)
    private String venue; // DCC 대전컨벤션센터 등
    @Column(name = "start_time")
    private String startTime; // ex: "18:00:00"
    @Column(name = "end_time")
    private String endTime; // ex: "23:00:00"
    @Column(name = "min_price")
    private Long minPrice; // 최소 티켓 가격 (ex: 55000)
    @Column(name = "thumbnail_url", columnDefinition = "TEXT")
    private String thumbnailUrl; // 행사 대표 포스터 썸네일 이미지
    @Column(name = "badge_label", length = 50)
    private String badgeLabel; // 'HOT', '신규', '타임세일' 등
    @Column(name = "is_hot", nullable = true)
    @Builder.Default
    private Boolean isHot = false;

    @Column(name = "review_status", length = 50)
    @Builder.Default
    private String reviewStatus = "PENDING"; // 'PENDING', 'APPROVED', 'REJECTED'

    @Column(name = "operational_status", length = 50)
    @Builder.Default
    private String operationalStatus = "UPCOMING"; // 'UPCOMING', 'ONGOING', 'COMPLETED'

    @Column(name = "agency", length = 255)
    private String agency; // 기획사/신청 기관

    @Column(name = "proposal_file_url", columnDefinition = "TEXT")
    private String proposalFileUrl; // 행사 기획서 PDF 파일 경로

    @Column(name = "company_intro_url", columnDefinition = "TEXT")
    private String companyIntroUrl; // 회사 소개서 PDF 파일 경로

    @Column(name = "description_html", columnDefinition = "TEXT")
    private String descriptionHtml; // 관리자가 편집한 상세페이지 탭 HTML 내용

    @Transient
    @Builder.Default
    private Boolean isNew = false;

    @Transient
    private String dday;

    @Column(name = "view_count", nullable = true)
    @Builder.Default
    private Long viewCount = 0L;

    /**
     * 예매 방식 구분:
     * 'SEAT' = 콘서트처럼 좌석 선택이 필요한 행사 (기본값)
     * 'FREE' = 워터밤처럼 좌석 없이 입장권만 필요한 행사
     */
    @Column(name = "ticket_mode", length = 20)
    @Builder.Default
    private String ticketMode = "SEAT";


    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.isActive == null) {
            this.isActive = true;
        }
        if (this.reviewStatus == null) {
            this.reviewStatus = "PENDING";
        }
        if (this.operationalStatus == null) {
            this.operationalStatus = "UPCOMING";
        }
    }

    @PostLoad
    protected void onPostLoad() {
        if (this.reviewStatus == null) {
            this.reviewStatus = "APPROVED"; // 기존의 데이터베이스 축제 데이터는 검수 완료된 Live(APPROVED) 상태로 처리
        }
        
        // [실시간 런타임 상태 비교 연산]
        if (this.startDate != null && this.endDate != null) {
            LocalDateTime now = LocalDateTime.now();
            String startT = (this.startTime == null || this.startTime.trim().isEmpty()) ? "00:00:00" : this.startTime.trim();
            String endT = (this.endTime == null || this.endTime.trim().isEmpty()) ? "23:59:59" : this.endTime.trim();
            
            try {
                if (startT.length() == 5) startT += ":00";
                if (endT.length() == 5) endT += ":00";
                
                java.time.LocalTime parsedStartTime = java.time.LocalTime.parse(startT);
                java.time.LocalTime parsedEndTime = java.time.LocalTime.parse(endT);
                
                LocalDateTime startDateTime = LocalDateTime.of(this.startDate, parsedStartTime);
                LocalDateTime endDateTime = LocalDateTime.of(this.endDate, parsedEndTime);
                
                if (now.isAfter(endDateTime)) {
                    this.operationalStatus = "COMPLETED";
                } else if (now.isAfter(startDateTime) || now.isEqual(startDateTime)) {
                    this.operationalStatus = "ONGOING";
                } else {
                    this.operationalStatus = "UPCOMING";
                }
            } catch (Exception e) {
                this.operationalStatus = "UPCOMING";
            }
        } else {
            this.operationalStatus = "UPCOMING";
        }

        // 1. 신규 여부 계산 (등록일 기준 7일 이내)
        if (this.createdAt != null) {
            this.isNew = this.createdAt.isAfter(LocalDateTime.now().minusDays(7));
        } else {
            this.isNew = false;
        }

        // 2. D-Day 계산
        if (this.startDate != null) {
            LocalDate now = LocalDate.now();
            long days = java.time.temporal.ChronoUnit.DAYS.between(now, this.startDate);
            if (days > 0) {
                this.dday = "D-" + days;
            } else if (days == 0) {
                this.dday = "D-Day";
            } else {
                if (this.endDate != null && now.isAfter(this.endDate)) {
                    this.dday = "종료";
                } else {
                    this.dday = "진행중";
                }
            }
        } else {
            this.dday = "-";
        }
    }
}
