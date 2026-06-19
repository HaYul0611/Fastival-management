import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

public class DumpUser {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?prepareThreshold=0";
        String user = "postgres.loqsekbplftdjphzewmx";
        String password = "naver.com1!";
        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            String sql = "SELECT * FROM app_user WHERE email = ?";
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, "sohee@naver.com");
                try (ResultSet rs = pstmt.executeQuery()) {
                    if (rs.next()) {
                        System.out.println("id: " + rs.getString("id"));
                        System.out.println("email: " + rs.getString("email"));
                        System.out.println("password: " + rs.getString("password"));
                        System.out.println("status: " + rs.getString("status"));
                        System.out.println("role: " + rs.getString("role"));
                        System.out.println("name: " + rs.getString("name"));
                    } else {
                        System.out.println("User not found.");
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
