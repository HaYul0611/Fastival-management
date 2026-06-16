package festival.festival.controller;

import festival.festival.entity.CartItem;
import festival.festival.service.CartService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    private final String MOCK_USER_ID = "test-user";

    @GetMapping
    public ResponseEntity<List<CartItem>> getCartItems() {
        return ResponseEntity.ok(cartService.getCartItems(MOCK_USER_ID));
    }

    @PostMapping
    public ResponseEntity<CartItem> addCartItem(@RequestBody CartItemRequest req) {
        return ResponseEntity.ok(cartService.addCartItem(
                MOCK_USER_ID, req.getEventId(), req.getZoneName(), req.getQuantity(), req.getPrice()));
    }

    @PutMapping("/{cartItemId}")
    public ResponseEntity<CartItem> updateCartItemQuantity(@PathVariable Long cartItemId, @RequestParam int quantity) {
        return ResponseEntity.ok(cartService.updateCartItemQuantity(cartItemId, quantity));
    }

    @DeleteMapping("/{cartItemId}")
    public ResponseEntity<Void> removeCartItem(@PathVariable Long cartItemId) {
        cartService.removeCartItem(cartItemId);
        return ResponseEntity.ok().build();
    }

    @Data
    public static class CartItemRequest {
        private String eventId;
        private String zoneName;
        private int quantity;
        private int price;
    }
}
