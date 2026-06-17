package festival.festival.controller;

import festival.festival.entity.WishlistItem;
import festival.festival.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/wishlist")
@RequiredArgsConstructor
public class WishlistController {

    private final WishlistService wishlistService;

    private final String MOCK_USER_ID = "test-user";

    @GetMapping
    public ResponseEntity<List<WishlistItem>> getWishlists() {
        return ResponseEntity.ok(wishlistService.getWishlists(MOCK_USER_ID));
    }

    @PostMapping("/{eventId}")
    public ResponseEntity<WishlistItem> addWishlist(@PathVariable String eventId) {
        return ResponseEntity.ok(wishlistService.addWishlist(MOCK_USER_ID, eventId));
    }

    @DeleteMapping("/{eventId}")
    public ResponseEntity<Void> removeWishlist(@PathVariable String eventId) {
        wishlistService.removeWishlist(MOCK_USER_ID, eventId);
        return ResponseEntity.ok().build();
    }
}
