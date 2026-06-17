package festival.user.controller;

import festival.user.service.MailService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final MailService mailService;
    private final festival.user.service.SupabaseAuthService supabaseAuthService;

    @Data
    public static class EmailRequest {
        private String email;
    }
    
    @Data
    public static class SignupRequest {
        private String email;
        private String password;
    }

    @Data
    public static class VerifyRequest {
        private String email;
        private String code;
    }

    @PostMapping("/send-email")
    public ResponseEntity<Map<String, Object>> sendEmail(@RequestBody EmailRequest request) {
        Map<String, Object> response = new HashMap<>();
        try {
            mailService.sendAuthEmail(request.getEmail());
            response.put("success", true);
            response.put("message", "인증번호가 발송되었습니다.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Map<String, Object>> verifyEmail(@RequestBody VerifyRequest request) {
        Map<String, Object> response = new HashMap<>();
        boolean isValid = mailService.verifyCode(request.getEmail(), request.getCode());
        
        if (isValid) {
            response.put("success", true);
            response.put("message", "인증이 완료되었습니다.");
            return ResponseEntity.ok(response);
        } else {
            response.put("success", false);
            response.put("message", "인증번호가 일치하지 않거나 만료되었습니다.");
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody SignupRequest request) {
        Map<String, Object> response = new HashMap<>();
        try {
            Map<String, Object> userResult = supabaseAuthService.createUserAdmin(request.getEmail(), request.getPassword());
            response.put("success", true);
            response.put("id", userResult.get("id")); // Supabase에서 발급한 UUID 반환
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
}
