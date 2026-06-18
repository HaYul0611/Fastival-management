package festival.user.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "custom.mail")
public class CustomMailProperties {

    private List<Account> accounts;

    @Data
    public static class Account {
        private String username;
        private String password;
    }
}
