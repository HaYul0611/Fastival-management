package festival.order.controller;

import festival.order.domain.ProductEntity;
import festival.order.domain.StoreEntity;
import festival.order.service.ProductService;
import festival.order.service.StoreService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stores")
public class StoreController {

    private final StoreService storeService;
    private final ProductService productService;

    public StoreController(StoreService storeService, ProductService productService) {
        this.storeService = storeService;
        this.productService = productService;
    }

    /**
     * 특정 행사(festivalId)에 참여하는 상점 목록 조회 (일반 사용자용)
     */
    @GetMapping
    public ResponseEntity<List<StoreEntity>> getStoresByFestival(
            @RequestParam(value = "festivalId", required = false) Long festivalId) {
        if (festivalId == null) {
            return ResponseEntity.ok(storeService.getAllStores());
        }
        List<StoreEntity> stores = storeService.getStoresByFestival(festivalId);
        return ResponseEntity.ok(stores);
    }

    /**
     * 특정 상점의 상품/메뉴 목록 조회 (일반 사용자용)
     */
    @GetMapping("/{id}/products")
    public ResponseEntity<List<ProductEntity>> getStoreProducts(@PathVariable("id") Long id) {
        List<ProductEntity> products = productService.getProductsByStore(id);
        return ResponseEntity.ok(products);
    }
}
