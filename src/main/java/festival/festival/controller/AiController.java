package festival.festival.controller;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    @org.springframework.beans.factory.annotation.Value("${HF_API_KEY:}")
    private String envApiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping("/generate")
    public ResponseEntity<?> generateAiAvatar(@RequestBody Map<String, String> request) {
        String prompt = request.get("prompt");
        // 프론트엔드에서 보낸 키가 없으면 환경변수(.env)의 키를 사용합니다.
        String apiKey = request.get("apiKey");
        if (apiKey == null || apiKey.isEmpty() || apiKey.equals("YOUR_HUGGING_FACE_API_KEY")) {
            apiKey = envApiKey;
        }
        if (apiKey != null) {
            apiKey = apiKey.trim();
        }

        String url = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell";

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + apiKey);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, String> body = new HashMap<>();
        body.put("inputs", prompt);

        HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.POST, entity, byte[].class);
            
            HttpHeaders resHeaders = new HttpHeaders();
            resHeaders.setContentType(MediaType.IMAGE_JPEG);
            return new ResponseEntity<>(response.getBody(), resHeaders, HttpStatus.OK);
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getResponseBodyAsString());
        } catch (Exception e) {
            e.printStackTrace();
            String errorMsg = e.getMessage() != null ? e.getMessage().replace("\"", "\\\"") : "Unknown Error";
            if (errorMsg.contains("UnknownHostException")) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("{\"error\": \"DNS_ERROR\", \"message\": \"DNS 서버를 찾을 수 없습니다.\"}");
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("{\"error\": \"SERVER_ERROR\", \"message\": \"" + errorMsg + "\"}");
        }
    }
}
