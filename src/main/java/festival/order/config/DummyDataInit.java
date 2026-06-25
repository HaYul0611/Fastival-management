package festival.order.config;

import festival.order.service.ProductService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DummyDataInit {

    @Bean
    public CommandLineRunner initDatabase(ProductService productService, org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
        return args -> {
            // System.out.println("==================================================");
            // System.out.println("   [데이터 초기화] 현재 데이터 주입/삭제 기능은 비활성화되어 있습니다...");
            // System.out.println("   [데이터베이스 스키마 업데이트] orders 테이블에 qr_code, is_entered, ticket_type 속성 추가 시도 중...");
            try {
                jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_code VARCHAR(255) UNIQUE;");
                jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_entered BOOLEAN DEFAULT FALSE;");
                jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(50);");
                // System.out.println("   [데이터베이스 스키마 업데이트] 완료!");
            } catch (Exception e) {
                // System.out.println("   [데이터베이스 스키마 업데이트] 실패 (또는 이미 존재함): " + e.getMessage());
            }
            // System.out.println("==================================================");
            try {
                Integer productCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM product", Integer.class);
                if (productCount != null && productCount < 1000) {
                    // System.out.println("   [데이터 초기화] 기존 데이터를 정리하고 새로운 Mock 데이터를 생성합니다...");
                    jdbcTemplate.execute("DELETE FROM product");
                    jdbcTemplate.execute("DELETE FROM store");
                    // System.out.println("   [데이터 초기화] Mock 상점(100개) 및 상품(1000개) 데이터를 생성합니다...");

                    // 1. Food 상점 50개 생성
                    for (int s = 1; s <= 50; s++) {
                        String sName = "푸드트럭 맛집 " + s + "호점";
                        org.springframework.jdbc.support.KeyHolder keyHolder = new org.springframework.jdbc.support.GeneratedKeyHolder();
                        jdbcTemplate.update(connection -> {
                            java.sql.PreparedStatement ps = connection.prepareStatement("INSERT INTO store (name, category, is_open, festival_id) VALUES (?, ?, ?, ?)", new String[]{"id"});
                            ps.setString(1, sName);
                            ps.setString(2, "food");
                            ps.setBoolean(3, true);
                            ps.setLong(4, 1L); // 다비치 콘서트에 매핑
                            return ps;
                        }, keyHolder);
                        long storeId = keyHolder.getKey().longValue();

                        // 각 상점당 10개 상품
                        for (int i = 1; i <= 10; i++) {
                            String imgUrl = "/Festio/images/food" + ((i % 5) + 1) + ".jpg";
                            jdbcTemplate.update("INSERT INTO product (store_id, product_type, name, price, total_stock, available_stock, status, is_soldout, is_representative, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                    storeId, "FOOD", sName + " 인기 메뉴 " + i, 5000 + (i * 1000), 100, 100, "ON_SALE", false, i == 1, imgUrl);
                        }
                    }

                    // 2. Goods 상점 50개 생성
                    for (int s = 1; s <= 50; s++) {
                        String sName = "오피셜 굿즈 스토어 " + s + "호점";
                        org.springframework.jdbc.support.KeyHolder keyHolder = new org.springframework.jdbc.support.GeneratedKeyHolder();
                        jdbcTemplate.update(connection -> {
                            java.sql.PreparedStatement ps = connection.prepareStatement("INSERT INTO store (name, category, is_open, festival_id) VALUES (?, ?, ?, ?)", new String[]{"id"});
                            ps.setString(1, sName);
                            ps.setString(2, "goods");
                            ps.setBoolean(3, true);
                            ps.setLong(4, 1L); // 다비치 콘서트에 매핑
                            return ps;
                        }, keyHolder);
                        long storeId = keyHolder.getKey().longValue();

                        // 각 상점당 10개 상품
                        for (int i = 1; i <= 10; i++) {
                            String imgUrl = "/Festio/images/goods" + ((i % 5) + 1) + ".jpg";
                            jdbcTemplate.update("INSERT INTO product (store_id, product_type, name, price, total_stock, available_stock, status, is_soldout, is_representative, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                    storeId, "GOODS", sName + " 한정판 MD " + i, 15000 + (i * 2000), 50, 50, "ON_SALE", false, i <= 2, imgUrl);
                        }
                    }
                    // System.out.println("   [데이터 초기화] 상점(100) 및 상품(1000) Mock 데이터 생성 완료!");
                }
            } catch (Exception e) {
                // System.out.println("   [데이터 초기화] Mock 데이터 생성 실패: " + e.getMessage());
            }
        };
    }
}
