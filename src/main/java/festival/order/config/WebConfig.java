package festival.order.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 브라우저에서 /uploads/파일명.png 로 접근하면 실제 uploads 폴더의 파일을 보여주도록 매핑
        // OS 간의 경로 구분자 차이 및 호스트 인식 오류 방지를 위해 상대 경로 접두사 사용
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:./uploads/");
    }

}
