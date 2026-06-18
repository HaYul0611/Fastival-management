package festival.user.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import org.springframework.mail.javamail.JavaMailSenderImpl;
import festival.user.config.CustomMailProperties;
import jakarta.annotation.PostConstruct;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Random;
import java.util.List;
import java.util.ArrayList;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Slf4j
@Service
@RequiredArgsConstructor
public class MailService {

    private final CustomMailProperties customMailProperties;
    private final List<JavaMailSender> mailSenders = new ArrayList<>();
    private final AtomicInteger currentIndex = new AtomicInteger(0);
    
    @PostConstruct
    public void init() {
        if (customMailProperties.getAccounts() == null || customMailProperties.getAccounts().isEmpty()) {
            log.warn("No mail accounts configured in custom.mail.accounts!");
            return;
        }

        for (CustomMailProperties.Account account : customMailProperties.getAccounts()) {
            JavaMailSenderImpl sender = new JavaMailSenderImpl();
            sender.setHost("smtp.gmail.com");
            sender.setPort(587);
            sender.setUsername(account.getUsername());
            sender.setPassword(account.getPassword());
            
            Properties props = sender.getJavaMailProperties();
            props.put("mail.transport.protocol", "smtp");
            props.put("mail.smtp.auth", "true");
            props.put("mail.smtp.starttls.enable", "true");
            props.put("mail.smtp.starttls.required", "true");
            props.put("mail.debug", "false");
            
            mailSenders.add(sender);
            log.info("Initialized MailSender for: {}", account.getUsername());
        }
    }
    
    // 이메일 -> { 인증번호, 생성시간 }
    private final Map<String, AuthCodeEntry> authCodeMap = new ConcurrentHashMap<>();

    private static class AuthCodeEntry {
        String code;
        LocalDateTime expiryTime;

        AuthCodeEntry(String code, LocalDateTime expiryTime) {
            this.code = code;
            this.expiryTime = expiryTime;
        }
    }

    public void sendAuthEmail(String email) {
        String code = generateCode();
        // 3분 유효
        authCodeMap.put(email, new AuthCodeEntry(code, LocalDateTime.now().plusMinutes(3)));

        String htmlContent = "<!DOCTYPE html>\n" +
                "<html>\n" +
                "<head>\n" +
                "<meta charset=\"utf-8\">\n" +
                "</head>\n" +
                "<body style=\"font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; background-color: #f4f7f6; padding: 50px 20px; color: #333; line-height: 1.6; margin: 0;\">\n" +
                "  <div style=\"max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 40px 50px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center;\">\n" +
                "    <h1 style=\"margin-bottom: 25px; letter-spacing: -0.5px;\">\n" +
                "      <span style=\"font-weight: 900; font-size: 36px; letter-spacing: 2px;\">\n" +
                "        <span style=\"color: #3b82f6;\">F</span>\n" +
                "        <span style=\"color: #2a92ef;\">E</span>\n" +
                "        <span style=\"color: #1aa1e8;\">S</span>\n" +
                "        <span style=\"color: #09b1e1;\">T</span>\n" +
                "        <span style=\"color: #04badc;\">I</span>\n" +
                "        <span style=\"color: #06b6d4;\">O</span>\n" +
                "      </span>\n" +
                "    </h1>\n" +
                "    <h2 style=\"color: #1f2937; font-size: 22px; font-weight: 700; margin-bottom: 15px; letter-spacing: -0.3px;\">\n" +
                "      이메일 인증 안내\n" +
                "    </h2>\n" +
                "    <p style=\"font-size: 15px; color: #4b5563; margin-bottom: 35px; word-break: keep-all;\">\n" +
                "      환영합니다! 안전한 회원가입을 위해 아래의 인증번호 6자리를<br>진행 중인 화면에 입력해 주세요.\n" +
                "    </p>\n" +
                "    <div style=\"background: linear-gradient(to right, #f8fafc, #f1f5f9); padding: 25px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e2e8f0;\">\n" +
                "      <span style=\"font-size: 36px; font-weight: 800; color: #3b82f6; letter-spacing: 8px;\">" + code + "</span>\n" +
                "    </div>\n" +
                "    <div style=\"margin-bottom: 35px;\">\n" +
                "      <a href=\"http://localhost:8082/Festio/register.html?fromEmail=true\" style=\"display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 8px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);\">인증번호 입력하기</a>\n" +
                "    </div>\n" +
                "    <p style=\"font-size: 13px; color: #64748b; margin-bottom: 40px; background-color: #f8fafc; padding: 15px; border-radius: 8px; text-align: left;\">\n" +
                "      💡 <b>안내사항</b><br>\n" +
                "      • 해당 인증번호는 발송 시점으로부터 <b>3분간</b> 유효합니다.<br>\n" +
                "      • 본인이 가입을 요청하지 않으셨다면 이 메일을 무시해 주세요.\n" +
                "    </p>\n" +
                "    <div style=\"border-top: 1px solid #e2e8f0; padding-top: 25px; font-size: 12px; color: #94a3b8;\">\n" +
                "      © 2026 FESTIO. All rights reserved.\n" +
                "    </div>\n" +
                "  </div>\n" +
                "</body>\n" +
                "</html>";

        try {
            if (mailSenders.isEmpty()) {
                throw new RuntimeException("등록된 메일 발송 계정이 없습니다.");
            }

            // 라운드 로빈 방식으로 메일 발송기 선택
            int index = Math.abs(currentIndex.getAndIncrement() % mailSenders.size());
            JavaMailSender sender = mailSenders.get(index);
            
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setTo(email);
            helper.setSubject("[Festio] 이메일 인증번호를 확인해 주세요.");
            helper.setText(htmlContent, true);
            
            sender.send(message);
            log.info("Auth email sent to {} using account index {}", email, index);
        } catch (MessagingException e) {
            log.error("Failed to send email to {}", email, e);
            throw new RuntimeException("이메일 발송에 실패했습니다.");
        }
    }

    public boolean verifyCode(String email, String code) {
        AuthCodeEntry entry = authCodeMap.get(email);
        if (entry == null) {
            return false;
        }

        if (LocalDateTime.now().isAfter(entry.expiryTime)) {
            authCodeMap.remove(email);
            return false;
        }

        if (entry.code.equals(code)) {
            authCodeMap.remove(email); // 인증 성공시 즉시 폐기
            return true;
        }
        
        return false;
    }

    private String generateCode() {
        Random random = new Random();
        int code = 100000 + random.nextInt(900000);
        return String.valueOf(code);
    }
}
