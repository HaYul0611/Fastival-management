package festival.festival.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/external")
@RequiredArgsConstructor
public class ExternalApiController {

    private final RestTemplate restTemplate = new RestTemplate();
    private static final String KOPIS_KEY = "6156a605351f4790954ec109178034b7";
    private static final String TOUR_KEY = "8507fc92e13f94fe27aa4b31d96e6544d2c607909b221d682b02508f105de532"; // URL 인코딩 불필요 시 그대로 사용, 문제 시 인코딩된 버전 사용

    @GetMapping(value = "/kopis", produces = "application/xml;charset=UTF-8")
    public ResponseEntity<String> getKopis(
            @RequestParam(value = "cpage", defaultValue = "1") int cpage,
            @RequestParam(value = "rows", defaultValue = "100") int rows,
            @RequestParam(value = "stdate", defaultValue = "20240101") String stdate,
            @RequestParam(value = "eddate", defaultValue = "20241231") String eddate) {
        
        String url = String.format("http://kopis.or.kr/openApi/restful/pblprfr?service=%s&stdate=%s&eddate=%s&cpage=%d&rows=%d", 
                KOPIS_KEY, stdate, eddate, cpage, rows);
        try {
            byte[] responseBytes = restTemplate.getForObject(url, byte[].class);
            String response = responseBytes != null ? new String(responseBytes, java.nio.charset.StandardCharsets.UTF_8) : "";
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("application/xml;charset=UTF-8"))
                    .body(response);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("<error>" + e.getMessage() + "</error>");
        }
    }

    @GetMapping(value = "/tour", produces = "application/json;charset=UTF-8")
    public ResponseEntity<String> getTour(
            @RequestParam(value = "pageNo", defaultValue = "1") int pageNo,
            @RequestParam(value = "numOfRows", defaultValue = "100") int numOfRows,
            @RequestParam(value = "eventStartDate", defaultValue = "20240101") String eventStartDate) {
        
        String url = String.format("http://apis.data.go.kr/B551011/KorService1/searchFestival1?serviceKey=%s&MobileOS=ETC&MobileApp=AppTest&_type=json&arrange=A&eventStartDate=%s&pageNo=%d&numOfRows=%d", 
                TOUR_KEY, eventStartDate, pageNo, numOfRows);
        try {
            java.net.URI uri = java.net.URI.create(url);
            byte[] responseBytes = restTemplate.getForObject(uri, byte[].class);
            String response = responseBytes != null ? new String(responseBytes, java.nio.charset.StandardCharsets.UTF_8) : "";
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("application/json;charset=UTF-8"))
                    .body(response);
        } catch (Exception e) {
            System.err.println("Tour API Error: " + e.getMessage());
            // 공공데이터 API 오류 시 마이페이지 등 대시보드가 깨지지 않도록 정상적인 빈 JSON 구조 반환
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType("application/json;charset=UTF-8"))
                    .body("{\"response\":{\"header\":{\"resultCode\":\"99\",\"resultMsg\":\"Tour API Error\"},\"body\":{\"items\":{\"item\":[]},\"numOfRows\":100,\"pageNo\":1,\"totalCount\":0}}}");
        }
    }
}
