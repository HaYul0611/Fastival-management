import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;

public class ResetPassword {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?prepareThreshold=0";
        String user = "postgres.loqsekbplftdjphzewmx";
        String password = "naver.com1!";
        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            String sql = "UPDATE app_user SET password = ? WHERE email = ?";
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                // BCrypt hash for "1234"
                pstmt.setString(1, "$2a$10$2rhvv8MJX3MZ51v6FfWZ6uJGpSvQ0t0aHLScg61lzomf5UjtYVYhi");
                pstmt.setString(2, "sohee@naver.com");
                int rows = pstmt.executeUpdate();
                System.out.println("Updated rows: " + rows);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
