package festival.user.controller;

import festival.user.domain.UserVo;
import festival.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 어드민 전용 회원 및 등급 관리 REST API 컨트롤러
 * 
 * GET   /api/admin/members             -> 회원 전체 목록 조회
 * PATCH /api/admin/members/{id}/status -> 회원 계정 상태(ACTIVE/BANNED) 변경
 * PATCH /api/admin/members/{id}/role   -> 회원 권한(ROLE_USER/ROLE_STAFF/ROLE_ADMIN) 변경
 */
@RestController
@RequestMapping("/api/admin/members")
@RequiredArgsConstructor
public class AdminMemberController {

    private final UserService userService;

    /**
     * 전체 회원 목록을 조회합니다.
     * GET /api/admin/members
     */
    @GetMapping
    public ResponseEntity<List<UserVo>> getAllMembers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    /**
     * 회원의 상태를 변경합니다.
     * PATCH /api/admin/members/{id}/status?status=BANNED
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<UserVo> updateStatus(
            @PathVariable("id") String id,
            @RequestParam("status") String status) {
        try {
            UserVo updated = userService.updateStatus(id, status);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 회원의 권한을 변경합니다.
     * PATCH /api/admin/members/{id}/role?role=ROLE_STAFF
     */
    @PatchMapping("/{id}/role")
    public ResponseEntity<UserVo> updateRole(
            @PathVariable("id") String id,
            @RequestParam("role") String role) {
        try {
            UserVo updated = userService.updateRole(id, role);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * 신규 게이트 스탭 또는 가맹점 스탭 계정을 생성합니다.
     * POST /api/admin/members/staff
     */
    @PostMapping("/staff")
    public ResponseEntity<?> registerStaff(@RequestBody StaffRegisterRequest request) {
        try {
            UserVo staff = UserVo.builder()
                    .email(request.getEmail())
                    .name(request.getName())
                    .password(request.getPassword())
                    .phone(request.getPhone())
                    .build();
            UserVo created = userService.registerStaff(staff, request.getRole());
            return ResponseEntity.ok(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @lombok.Data
    public static class StaffRegisterRequest {
        private String email;
        private String password;
        private String name;
        private String phone;
        private String role; // "ROLE_GATE_STAFF" or "ROLE_STAFF"
    }
}
