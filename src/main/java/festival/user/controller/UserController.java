package festival.user.controller;

import festival.user.domain.UserVo;
import festival.user.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/auth")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody UserVo userVo) {
        try {
            UserVo registeredUser = userService.register(userVo);
            return ResponseEntity.ok(registeredUser);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("회원가입 처리 중 서버 에러가 발생했습니다.");
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            String password = request.get("password");

            if (email == null || password == null) {
                return ResponseEntity.badRequest().body("아이디와 비밀번호를 입력해주세요.");
            }

            UserVo user = userService.login(email, password);

            Map<String, Object> response = new HashMap<>();
            response.put("token", "festio-jwt-token-" + user.getId());
            response.put("userName", user.getName());
            response.put("userRole", user.getRole());
            response.put("email", user.getEmail());
            response.put("phone", user.getPhone());

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("로그인 처리 중 서버 에러가 발생했습니다.");
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMe(@RequestHeader(value = "Authorization", required = false) String token) {
        try {
            String userId = null;
            if (token == null) {
                return ResponseEntity.status(401).body("로그인이 필요합니다.");
            }
            if (token.startsWith("festio-jwt-token-")) {
                userId = token.substring("festio-jwt-token-".length());
            } else if (token.equals("festio-admin-jwt-token-7777")) {
                UserVo admin = userService.findByEmail("admin@gmail.com");
                if (admin != null) {
                    userId = admin.getId();
                } else {
                    return ResponseEntity.status(401).body("관리자 계정이 존재하지 않습니다.");
                }
            } else {
                return ResponseEntity.status(401).body("로그인이 필요합니다.");
            }

            UserVo user = userService.findById(userId);
            if (user == null) {
                return ResponseEntity.status(404).body("사용자를 찾을 수 없습니다.");
            }
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("사용자 정보 조회 중 오류가 발생했습니다.");
        }
    }

    @PostMapping("/update")
    public ResponseEntity<?> updateProfile(
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody Map<String, String> request) {
        try {
            String userId = null;
            if (token == null) {
                return ResponseEntity.status(401).body("로그인이 필요합니다.");
            }
            if (token.startsWith("festio-jwt-token-")) {
                userId = token.substring("festio-jwt-token-".length());
            } else if (token.equals("festio-admin-jwt-token-7777")) {
                UserVo admin = userService.findByEmail("admin@gmail.com");
                if (admin != null) {
                    userId = admin.getId();
                } else {
                    return ResponseEntity.status(401).body("관리자 계정이 존재하지 않습니다.");
                }
            } else {
                return ResponseEntity.status(401).body("로그인이 필요합니다.");
            }

            String name = request.get("name");
            String phone = request.get("phone");

            if (name == null || phone == null) {
                return ResponseEntity.badRequest().body("닉네임과 연락처를 모두 입력해주세요.");
            }

            UserVo updated = userService.updateProfile(userId, name, phone);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("프로필 업데이트 중 오류가 발생했습니다.");
        }
    }
    @PostMapping("/updatePassword")
    public ResponseEntity<?> updatePassword(
            @RequestHeader(value = "Authorization", required = false) String token,
            @RequestBody Map<String, String> request) {
        try {
            String userId = null;
            if (token == null) {
                return ResponseEntity.status(401).body("로그인이 필요합니다.");
            }
            if (token.startsWith("festio-jwt-token-")) {
                userId = token.substring("festio-jwt-token-".length());
            } else if (token.equals("festio-admin-jwt-token-7777")) {
                UserVo admin = userService.findByEmail("admin@gmail.com");
                if (admin != null) {
                    userId = admin.getId();
                } else {
                    return ResponseEntity.status(401).body("관리자 계정이 존재하지 않습니다.");
                }
            } else {
                return ResponseEntity.status(401).body("로그인이 필요합니다.");
            }

            String currentPassword = request.get("currentPassword");
            String newPassword = request.get("newPassword");

            if (currentPassword == null || newPassword == null) {
                return ResponseEntity.badRequest().body("현재 비밀번호와 새 비밀번호를 모두 입력해주세요.");
            }

            userService.updatePassword(userId, currentPassword, newPassword);
            return ResponseEntity.ok("비밀번호가 성공적으로 변경되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("비밀번호 변경 중 오류가 발생했습니다.");
        }
    }

    @DeleteMapping("/me")
    public ResponseEntity<?> withdrawUser(@RequestHeader(value = "Authorization", required = false) String token) {
        try {
            String userId = null;
            if (token == null) {
                return ResponseEntity.status(401).body("로그인이 필요합니다.");
            }
            if (token.startsWith("festio-jwt-token-")) {
                userId = token.substring("festio-jwt-token-".length());
            } else if (token.equals("festio-admin-jwt-token-7777")) {
                UserVo admin = userService.findByEmail("admin@gmail.com");
                if (admin != null) {
                    userId = admin.getId();
                } else {
                    return ResponseEntity.status(401).body("관리자 계정이 존재하지 않습니다.");
                }
            } else {
                return ResponseEntity.status(401).body("로그인이 필요합니다.");
            }

            userService.withdrawUser(userId);
            return ResponseEntity.ok("회원 탈퇴가 완료되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("회원 탈퇴 처리 중 오류가 발생했습니다.");
        }
    }
}
