import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class CheckPassword {
    public static void main(String[] args) {
        String hash = "$2a$10$ngrirKcc.vQd9vkZpV6TZuSqRR9OWlKNptX36Pl3wMpcxofppLNqq";
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String[] passwords = {"1234", "123456", "password", "sohee", "sohee123", "sohee123!", "sohee@naver.com", "admin", "user", "user123", "test", "test1234", "festio", "festio123!"};
        for (String p : passwords) {
            if (encoder.matches(p, hash)) {
                System.out.println("FOUND PASSWORD: " + p);
                return;
            }
        }
        System.out.println("NOT FOUND");
    }
}
