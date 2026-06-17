package festival.user.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
public class SupabaseAuthService {

    private final RestTemplate restTemplate = new RestTemplate();

    // 환경에 따라 properties에서 주입받는 것이 좋으나, 빠른 해결을 위해 하드코딩
    private static final String SUPABASE_URL = "https://loqsekbplftdjphzewmx.supabase.co";
    private static final String SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvcXNla2JwbGZ0ZGpwaHpld214Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc3Mzk0NiwiZXhwIjoyMDk1MzQ5OTQ2fQ.3MFHCa4uA2_P8tz99QfgVcy2r3uuqDYKJagA1PWnu1g";

    public Map<String, Object> createUserAdmin(String email, String password) {
        String url = SUPABASE_URL + "/auth/v1/admin/users";

        HttpHeaders headers = new HttpHeaders();
        headers.set("apikey", SERVICE_ROLE_KEY);
        headers.set("Authorization", "Bearer " + SERVICE_ROLE_KEY);
        headers.set("Content-Type", "application/json");

        Map<String, Object> body = new HashMap<>();
        body.put("email", email);
        body.put("password", password);
        body.put("email_confirm", true); // 이게 핵심! 이메일 인증 강제 통과

        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(url, HttpMethod.POST, requestEntity,
                    new org.springframework.core.ParameterizedTypeReference<Map<String, Object>>() {
                    });
            return response.getBody();
        } catch (Exception e) {
            log.error("Supabase Admin API Error: ", e);
            throw new RuntimeException("백엔드 가입 연동 실패: " + e.getMessage());
        }
    }
}
