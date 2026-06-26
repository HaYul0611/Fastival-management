package festival.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * [커스텀 토큰 인증 필터]
 * 
 * 이 프로젝트는 Spring Security 세션이 아닌 JavaScript localStorage 방식으로
 * 로그인 토큰을 관리합니다.
 * 
 * 이 필터는 모든 요청의 Authorization 헤더에서 커스텀 토큰을 읽어,
 * DB에서 해당 유저의 Role을 조회하고 Spring Security 인증 컨텍스트를 설정합니다.
 * 덕분에 API 엔드포인트의 hasRole() 인가 규칙이 정상 작동하게 됩니다.
 * 
 * 지원 토큰 형식:
 * - festio-admin-jwt-token-7777 → ROLE_ADMIN
 * - festio-jwt-token-{userId} → DB app_user.role 기준
 */
@Component
public class StaffTokenAuthFilter extends OncePerRequestFilter {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String token = request.getHeader("Authorization");

        // 이미 인증된 컨텍스트가 있으면 스킵
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                // "Bearer " 접두사 제거
                if (token.startsWith("Bearer ")) {
                    token = token.substring(7);
                }

                List<GrantedAuthority> authorities = new ArrayList<>();
                String principalName = null;

                if (token.equals("festio-admin-jwt-token-7777")) {
                    // 어드민 테스트 토큰 → ROLE_ADMIN 강제 부여
                    authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
                    principalName = "admin";

                } else if (token.startsWith("festio-jwt-token-")) {
                    // 일반 유저 토큰 → DB에서 실제 Role 조회
                    String userId = token.substring("festio-jwt-token-".length());

                    String sql = "SELECT role FROM app_user WHERE id = ?";
                    List<String> roles = jdbcTemplate.query(sql,
                            (rs, rowNum) -> rs.getString("role"), userId);

                    if (!roles.isEmpty() && roles.get(0) != null) {
                        String role = roles.get(0); // ex: "ROLE_STAFF", "ROLE_ADMIN"
                        authorities.add(new SimpleGrantedAuthority(role));
                        principalName = userId;
                    }
                }

                // 인증 정보 생성 및 SecurityContext 에 등록
                if (principalName != null && !authorities.isEmpty()) {
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            principalName, null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }

            } catch (Exception e) {
                // 토큰 파싱 실패 시 인증 없이 요청 통과 (인가 필터가 차단)
                System.err.println("[TokenAuthFilter] 토큰 인증 실패: " + e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }
}
