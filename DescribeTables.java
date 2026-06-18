import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;

public class DescribeTables {
    public static void main(String[] args) {
        String url = "jdbc:postgresql://aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?prepareThreshold=0";
        String user = "postgres.loqsekbplftdjphzewmx";
        String password = "naver.com1!";
        try (Connection conn = DriverManager.getConnection(url, user, password)) {
            DatabaseMetaData meta = conn.getMetaData();
            
            System.out.println("=== orders table columns ===");
            try (ResultSet rs = meta.getColumns(null, null, "orders", null)) {
                while (rs.next()) {
                    System.out.printf("Column: %s, Type: %s, Size: %d%n",
                            rs.getString("COLUMN_NAME"),
                            rs.getString("TYPE_NAME"),
                            rs.getInt("COLUMN_SIZE"));
                }
            }
            
            System.out.println("\n=== app_user table columns ===");
            try (ResultSet rs = meta.getColumns(null, null, "app_user", null)) {
                while (rs.next()) {
                    System.out.printf("Column: %s, Type: %s, Size: %d%n",
                            rs.getString("COLUMN_NAME"),
                            rs.getString("TYPE_NAME"),
                            rs.getInt("COLUMN_SIZE"));
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
