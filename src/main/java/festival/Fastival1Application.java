package festival;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class Fastival1Application {

	public static void main(String[] args) {
		SpringApplication.run(Fastival1Application.class, args);
	}

	@org.springframework.context.annotation.Bean
	public org.springframework.boot.CommandLineRunner migrateStaffRoles(
			org.springframework.jdbc.core.JdbcTemplate jdbcTemplate,
			org.springframework.security.crypto.password.PasswordEncoder passwordEncoder) {
		return args -> {
			try {
				// app_user 테이블의 id 타입이 bigint 또는 integer인 경우 uuid로 원상복구 마이그레이션 수행
				try {
					String currentDataType = null;
					try {
						currentDataType = jdbcTemplate.queryForObject(
							"SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_user' AND column_name = 'id'",
							String.class
						);
					} catch (Exception ignored) {}

					if (currentDataType == null || "bigint".equalsIgnoreCase(currentDataType) || "integer".equalsIgnoreCase(currentDataType)) {
						System.out.println("[Migration] Reverting app_user.id type back to uuid...");
						jdbcTemplate.execute("DROP TABLE IF EXISTS app_user CASCADE");
						jdbcTemplate.execute(
							"CREATE TABLE app_user (" +
							"    id uuid DEFAULT gen_random_uuid() PRIMARY KEY," +
							"    email VARCHAR(100) NOT NULL UNIQUE," +
							"    password VARCHAR(255) NOT NULL," +
							"    name VARCHAR(50) NOT NULL," +
							"    phone VARCHAR(20)," +
							"    role VARCHAR(20) NOT NULL DEFAULT 'ROLE_USER'," +
							"    membership_grade VARCHAR(20) NOT NULL DEFAULT 'BRONZE'," +
							"    balance INT NOT NULL DEFAULT 0," +
							"    face_vector TEXT," +
							"    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'," +
							"    store_id BIGINT," +
							"    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP," +
							"    CONSTRAINT chk_balance_positive CHECK (balance >= 0)" +
							")"
						);
						System.out.println("[Migration] Successfully reverted app_user.id to uuid.");
					}
				} catch (Exception e) {
					System.out.println("[Migration] Check table metadata skipped: " + e.getMessage());
				}

				System.out.println("[Migration] Starting migration of existing ROLE_STAFF roles...");
				String sql = "UPDATE app_user u " +
						"SET role = CASE " +
						"    WHEN s.category IN ('FOOD', 'DRINK') THEN 'ROLE_FOOD_STAFF' " +
						"    WHEN s.category = 'GATE' THEN 'ROLE_GATE_STAFF' " +
						"    WHEN s.category = 'GOODS' THEN 'ROLE_GOODS_STAFF' " +
						"    ELSE 'ROLE_STAFF' " +
						"END " +
						"FROM store s " +
						"WHERE u.store_id = s.id AND (u.role = 'ROLE_STAFF' OR u.role = 'STAFF')";
				int updatedRows = jdbcTemplate.update(sql);
				System.out.println(
						"[Migration] Successfully migrated " + updatedRows + " ROLE_STAFF users to granular roles.");

				// 관리자 계정(admin@gmail.com) 자동 생성
				Integer adminCount = jdbcTemplate.queryForObject(
					"SELECT COUNT(*) FROM app_user WHERE email = 'admin@gmail.com'", Integer.class
				);
				if (adminCount == null || adminCount == 0) {
					String encodedPw = passwordEncoder.encode("Password123!");
					jdbcTemplate.update(
						"INSERT INTO app_user (email, password, name, phone, role, membership_grade, balance, status) " +
						"VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
						"admin@gmail.com", encodedPw, "관리자", "010-0000-0000", "ROLE_ADMIN", "VIP", 1000000, "ACTIVE"
					);
					System.out.println("[Init] Created default admin account (admin@gmail.com / Password123!)");
				}

				// 기본 스태프 계정(staff@gmail.com) 자동 생성
				Integer staffCount = jdbcTemplate.queryForObject(
					"SELECT COUNT(*) FROM app_user WHERE email = 'staff@gmail.com'", Integer.class
				);
				if (staffCount == null || staffCount == 0) {
					String encodedPw = passwordEncoder.encode("Password123!");
					jdbcTemplate.update(
						"INSERT INTO app_user (email, password, name, phone, role, membership_grade, balance, status, store_id) " +
						"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
						"staff@gmail.com", encodedPw, "매장스태프", "010-1111-1111", "ROLE_FOOD_STAFF", "BRONZE", 0, "ACTIVE", 1L
					);
					System.out.println("[Init] Created default staff account (staff@gmail.com / Password123!)");
				}

				System.out.println("====== [DEBUG STORES & STAFF USERS] ======");
				jdbcTemplate.query("SELECT id, name, category FROM store", (rs, rowNum) -> {
					System.out.println("[Debug Store] ID: " + rs.getLong("id") + ", Name: " + rs.getString("name")
							+ ", Category: " + rs.getString("category"));
					return null;
				});
				jdbcTemplate.query(
						"SELECT id, email, role, store_id FROM app_user WHERE role LIKE '%STAFF%' OR email = 'admin@gmail.com'",
						(rs, rowNum) -> {
							System.out.println("[Debug User] ID: " + rs.getObject("id") + ", Email: "
									+ rs.getString("email") + ", Role: " + rs.getString("role") + ", StoreID: "
									+ rs.getLong("store_id"));
							return null;
						});
				System.out.println("=========================================");
			} catch (Exception e) {
				System.err.println("[Migration] Error during ROLE_STAFF migration or init: " + e.getMessage());
			}
		};
	}
}
