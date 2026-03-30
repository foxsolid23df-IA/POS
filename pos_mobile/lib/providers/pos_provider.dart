import 'package:flutter/material.dart';
import '../models/product.dart';
import '../services/product_service.dart';

class POSProvider extends ChangeNotifier {
  final ProductService _productService = ProductService();

  List<Product> _allProducts = [];
  List<Product> _filteredProducts = [];
  final List<CartItem> _cart = [];
  
  bool _isLoadingProducts = false;
  String _searchQuery = "";

  List<Product> get products => _filteredProducts;
  List<CartItem> get cart => _cart;
  bool get isLoadingProducts => _isLoadingProducts;
  
  double get cartTotal => _cart.fold(0, (total, item) => total + item.total);
  int get totalItems => _cart.fold(0, (count, item) => count + item.quantity);

  Future<void> loadProducts() async {
    _isLoadingProducts = true;
    notifyListeners();

    try {
      _allProducts = await _productService.getProducts();
      _filteredProducts = List.from(_allProducts);
    } catch (e) {
      debugPrint("Error loading products: \$e");
    } finally {
      _isLoadingProducts = false;
      notifyListeners();
    }
  }

  void searchProducts(String query) {
    _searchQuery = query.toLowerCase();
    if (_searchQuery.isEmpty) {
      _filteredProducts = List.from(_allProducts);
    } else {
      _filteredProducts = _allProducts.where((product) {
        return product.name.toLowerCase().contains(_searchQuery) ||
            (product.barcode != null && product.barcode!.contains(_searchQuery));
      }).toList();
    }
    notifyListeners();
  }

  void addToCart(Product product) {
    final existingItemIndex = _cart.indexWhere((item) => item.product.id == product.id);

    if (existingItemIndex != -1) {
      _cart[existingItemIndex].quantity += 1;
    } else {
      _cart.add(CartItem(product: product));
    }
    notifyListeners();
  }

  void decreaseQuantity(Product product) {
    final existingItemIndex = _cart.indexWhere((item) => item.product.id == product.id);
    
    if (existingItemIndex != -1) {
      if (_cart[existingItemIndex].quantity > 1) {
        _cart[existingItemIndex].quantity -= 1;
      } else {
        _cart.removeAt(existingItemIndex);
      }
      notifyListeners();
    }
  }

  void removeFromCart(Product product) {
    _cart.removeWhere((item) => item.product.id == product.id);
    notifyListeners();
  }

  void clearCart() {
    _cart.clear();
    notifyListeners();
  }
}
