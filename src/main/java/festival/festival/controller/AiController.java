package festival.festival.controller;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping("/generate")
    public ResponseEntity<?> generateAiAvatar(@RequestBody Map<String, String> request) {
        String prompt = request.get("prompt");
        String apiKey = request.get("apiKey");

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
            if (e.getMessage() != null && e.getMessage().contains("UnknownHostException")) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("{\"error\": \"DNS_ERROR\"}");
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("{\"error\": \"SERVER_ERROR\"}");
        }
    }
}
