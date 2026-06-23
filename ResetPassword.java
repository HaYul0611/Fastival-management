import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class ResetPassword {
    public static void main(String[] args) {
        try {
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
            String hash = encoder.encode("festio1234!");
            Connection conn = DriverManager.getConnection(
                "jdbc:postgresql://aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?prepareThreshold=0",
                "postgres.loqsekbplftdjphzewmx", "naver.com1!"
            );
            PreparedStatement pstmt = conn.prepareStatement("UPDATE app_user SET password = ? WHERE email = 'gate_staff_8807@festio.com'");
            pstmt.setString(1, hash);
            int rows = pstmt.executeUpdate();
            System.out.println("Updated rows: " + rows);
        } catch(Exception e) {
            e.printStackTrace();
        }
    }
}
