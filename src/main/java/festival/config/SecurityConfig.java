package festival.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private StaffTokenAuthFilter staffTokenAuthFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // [커스텀 토큰 인증 필터 등록]
            // Authorization 헤더의 토큰을 읽어 Spring Security 인증 컨텍스트를 설정합니다.
            // 이 필터 덕분에 localStorage 토큰이 hasRole() 인가 규칙과 연동됩니다.
            .addFilterBefore(staffTokenAuthFilter, UsernamePasswordAuthenticationFilter.class)

            .authorizeHttpRequests(authorize -> authorize
                // ===================================================
                // [API 인가 장벽] REST API 엔드포인트만 Spring Security로 보호
                // ===================================================
                // 일반 상점 조회 API: 누구나 접근 가능
                .requestMatchers("/api/stores/**").permitAll()
                // 어드민 REST API: ROLE_ADMIN 만 허용
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                // 스탭 로그인 API: 누구나 접근 가능해야 함
                .requestMatchers("/api/payment/staff/login").permitAll()
                // 스탭 REST API: ROLE_STAFF, ROLE_FOOD_STAFF, ROLE_GATE_STAFF, ROLE_GOODS_STAFF, ROLE_ADMIN 허용
                .requestMatchers("/api/payment/staff/**").hasAnyRole("STAFF", "FOOD_STAFF", "GATE_STAFF", "GOODS_STAFF", "ADMIN")

                // 그 외 모든 경로 (HTML 정적 파일, 리소스, 로그인 등): 모두 허용
                .anyRequest().permitAll()
            )
            // REST API 방식 사용 → Spring Security 내장 formLogin / httpBasic 비활성화
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(401);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write("{\"error\":\"unauthorized\",\"message\":\"로그인이 필요합니다.\"}");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    response.setStatus(403);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write("{\"error\":\"forbidden\",\"message\":\"접근 권한이 없습니다.\"}");
                })
            )
            .csrf(csrf -> csrf.disable())
            .headers(headers -> headers.frameOptions(frame -> frame.disable()));

        return http.build();
    }

    @Bean
    public org.springframework.security.crypto.password.PasswordEncoder passwordEncoder() {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
    }

    @Bean
    public org.springframework.web.client.RestTemplate restTemplate() {
        return new org.springframework.web.client.RestTemplate();
    }
}
