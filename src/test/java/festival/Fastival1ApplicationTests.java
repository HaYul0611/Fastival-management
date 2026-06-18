package festival;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.List;
import java.util.Map;

@SpringBootTest
class Fastival1ApplicationTests {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void contextLoads() {
		try {
			System.out.println("=== DB CONNECTIVITY DIAGNOSTICS ===");
			
			Integer userCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM app_user", Integer.class);
			System.out.println("Number of users in app_user: " + userCount);

			Integer orderCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM orders", Integer.class);
			System.out.println("Number of orders in orders: " + orderCount);

			System.out.println("\n--- USERS LIST ---");
			List<Map<String, Object>> users = jdbcTemplate.queryForList("SELECT id, name, email, role FROM app_user");
			for (Map<String, Object> user : users) {
				System.out.println(user);
			}

			System.out.println("\n--- ORDERS LIST ---");
			List<Map<String, Object>> orders = jdbcTemplate.queryForList("SELECT id, user_id, festival_id, total_price, payment_status, ticket_number, seat_ids, qr_code FROM orders");
			for (Map<String, Object> order : orders) {
				System.out.println(order);
			}
			
			System.out.println("==================================");
		} catch (Exception e) {
			System.err.println("Database query failed!");
			e.printStackTrace();
		}
	}

}

