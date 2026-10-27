import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartWishlist } from '../../context/CartWishlistContext';
import {
  ShoppingBag,
  X,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Lock,
  Sparkles,
} from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    cartCount,
    cartSubtotal,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    clearCart,
    initiateCartCheckout,
    isProcessingPayment,
  } = useCartWishlist();
  const navigate = useNavigate();

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    const success = await initiateCartCheckout();
    if (success) {
      navigate('/student/courses');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#EBF3FF] text-[#004AAD] flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#111827]">
                  Shopping Cart
                </h2>
                <span className="text-xs text-[#64748B]">
                  {cartCount} {cartCount === 1 ? 'course' : 'courses'} selected
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 text-[#64748B] hover:text-[#111827] rounded-lg hover:bg-slate-200/50 transition-colors"
              aria-label="Close cart drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 divide-y divide-[#E2E8F0]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#F1F5F9] text-[#64748B] flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 opacity-60" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-base font-bold text-[#111827]">
                    Your cart is empty
                  </h3>
                  <p className="text-xs text-[#64748B] max-w-xs">
                    Explore our top-rated engineering masterclasses and accelerate your tech career.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate('/courses');
                  }}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-xl shadow-xs transition-colors"
                >
                  Browse Marketplace
                </button>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 py-3 items-start group"
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-20 h-14 object-cover rounded-lg bg-slate-900 border border-[#E2E8F0] shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-[#004AAD] uppercase tracking-wider block">
                        {item.category}
                      </span>
                      <h4 className="text-xs font-bold text-[#111827] line-clamp-2 leading-snug">
                        {item.title}
                      </h4>
                      {item.instructorName && (
                        <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                          By {item.instructorName}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-display text-sm font-extrabold text-[#111827] tabular-nums">
                            ${item.price.toFixed(2)}
                          </span>
                          {item.originalPrice && item.originalPrice > item.price && (
                            <span className="text-[11px] text-[#64748B] line-through tabular-nums">
                              ${item.originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                          title="Remove item"
                          aria-label={`Remove ${item.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={clearCart}
                    className="text-[11px] text-[#64748B] hover:text-rose-600 transition-colors"
                  >
                    Clear all items
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer / Checkout */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-[#E2E8F0] bg-[#F8FAFC] space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#64748B]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#111827] tabular-nums">
                    ${cartSubtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Special Multi-Course Bundle Discount</span>
                  </span>
                  <span>Applied</span>
                </div>
                <div className="pt-2 border-t border-[#E2E8F0] flex justify-between items-baseline">
                  <span className="text-sm font-bold text-[#111827]">Total Due</span>
                  <div className="text-right">
                    <span className="font-display text-2xl font-extrabold text-[#111827] tabular-nums">
                      ${cartSubtotal.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-[#64748B] block">
                      ≈ ₹{(cartSubtotal * 83).toFixed(0)} INR via Razorpay
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isProcessingPayment}
                className="w-full py-3.5 px-4 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] disabled:opacity-75 disabled:cursor-not-allowed rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {isProcessingPayment
                    ? 'Processing Payment...'
                    : `Checkout with Razorpay (${cartCount})`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-4 text-[11px] text-[#64748B] pt-1">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>256-Bit SSL Encrypted</span>
                </div>
                <span>·</span>
                <span>Lifetime Access</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
