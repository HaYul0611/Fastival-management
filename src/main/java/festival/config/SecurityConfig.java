package festival.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(authorize -> authorize
                .anyRequest().permitAll() // 모든 페이지에 대해 로그인 없이 접근 허용
            )
            .csrf(csrf -> csrf.disable()) // 개발 편의를 위해 CSRF 보안 비활성화
            .headers(headers -> headers.frameOptions(frame -> frame.disable())); // H2 콘솔 등을 사용할 경우 대비 프레임 제한 해제
        
        return http.build();
    }
}
