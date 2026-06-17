package festival.user.service;

import festival.user.domain.UserVo;
import festival.user.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserVo register(UserVo user) {
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new IllegalArgumentException("이미 존재하는 이메일입니다.");
        }
        // 비밀번호 암호화
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        // 기본값 설정
        user.setRole("ROLE_USER");
        user.setMembershipGrade("BRONZE");
        user.setBalance(0);
        return userRepository.save(user);
    }

    public UserVo login(String email, String password) {
        UserVo user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다."));
        if ("WITHDRAWN".equals(user.getStatus())) {
            throw new IllegalArgumentException("탈퇴 처리된 계정입니다. 해당 계정으로는 로그인할 수 없습니다.");
        }
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        return user;
    }

    public UserVo findById(String id) {
        return userRepository.findById(id).orElse(null);
    }

    public UserVo findByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    @Transactional
    public UserVo updateProfile(String id, String name, String phone) {
        UserVo user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        user.setName(name);
        user.setPhone(phone);
        return userRepository.save(user);
    }

    public java.util.List<UserVo> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional
    public UserVo updateStatus(String id, String status) {
        UserVo user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        user.setStatus(status);
        return userRepository.save(user);
    }

    @Transactional
    public UserVo updateRole(String id, String role) {
        UserVo user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        user.setRole(role);
        return userRepository.save(user);
    }

    @Transactional
    public void withdrawUser(String id) {
        UserVo user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        user.setStatus("WITHDRAWN");
        user.setWithdrawnAt(java.time.LocalDateTime.now());
        userRepository.save(user);
    }

    @org.springframework.scheduling.annotation.Scheduled(cron = "0 0 3 * * ?") // 매일 새벽 3시
    @Transactional
    public void deleteWithdrawnUsers() {
        java.time.LocalDateTime thresholdDate = java.time.LocalDateTime.now().minusDays(30);
        java.util.List<UserVo> usersToDelete = userRepository.findByStatusAndWithdrawnAtBefore("WITHDRAWN", thresholdDate);
        userRepository.deleteAll(usersToDelete);
    }
}
