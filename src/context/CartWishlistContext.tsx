import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured, getAuthToken } from '../lib/supabase';
import { Course } from '../types';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export interface CartItem {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  thumbnail: string;
  category: string;
  instructorName?: string;
}

interface CartWishlistContextType {
  wishlist: string[];
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (course: Course | CartItem) => void;
  removeFromCart: (courseId: string) => void;
  clearCart: () => void;
  isInCart: (courseId: string) => boolean;
  enrolledCourseIds: string[];
  isProcessingPayment: boolean;
  isInWishlist: (courseId: string) => boolean;
  toggleWishlist: (courseId: string, courseTitle?: string) => Promise<void>;
  isEnrolled: (courseId: string) => boolean;
  initiateCourseEnrollment: (course: Course | { id: string; title: string; price: number }) => Promise<boolean>;
  initiateCartCheckout: () => Promise<boolean>;
  refreshUserData: () => Promise<void>;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
}

const CartWishlistContext = createContext<CartWishlistContextType | undefined>(undefined);

// Helper to dynamically load the official Razorpay checkout script
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('[Razorpay] Failed to load external checkout script.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export const CartWishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [wishlist, setWishlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('edufy_wishlist');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('edufy_enrollments');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('edufy_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refresh user data from Supabase if configured and logged in
  const refreshUserData = async () => {
    if (!isAuthenticated || !currentUser || !isSupabaseConfigured) return;

    try {
      // 1. Fetch live enrollments
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', currentUser.id)
        .eq('status', 'active');

      if (!enrollError && enrollments) {
        const ids = enrollments.map((e) => e.course_id);
        setEnrolledCourseIds(ids);
        localStorage.setItem('edufy_enrollments', JSON.stringify(ids));
      }

      // 2. Fetch live wishlist
      const { data: wishlists, error: wishError } = await supabase
        .from('wishlists')
        .select('course_id')
        .eq('user_id', currentUser.id);

      if (!wishError && wishlists) {
        const ids = wishlists.map((w) => w.course_id);
        setWishlist(ids);
        localStorage.setItem('edufy_wishlist', JSON.stringify(ids));
      }
    } catch (err) {
      console.warn('[CartWishlist] Error syncing with Supabase:', err);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      refreshUserData();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    localStorage.setItem('edufy_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('edufy_enrollments', JSON.stringify(enrolledCourseIds));
  }, [enrolledCourseIds]);

  useEffect(() => {
    localStorage.setItem('edufy_cart', JSON.stringify(cart));
  }, [cart]);

  const cartCount = cart.length;
  const cartSubtotal = cart.reduce((acc, item) => acc + item.price, 0);

  const isInCart = (courseId: string): boolean => {
    return cart.some((item) => item.id === courseId);
  };

  const addToCart = (course: Course | CartItem) => {
    if (isEnrolled(course.id)) {
      showToast('You already own lifetime access to this course!', 'info');
      return;
    }
    if (isInCart(course.id)) {
      showToast(`"${course.title}" is already in your cart.`, 'info');
      setIsCartOpen(true);
      return;
    }

    const item: CartItem = {
      id: course.id,
      title: course.title,
      price: course.price,
      originalPrice: course.originalPrice,
      category: course.category,
      thumbnail: course.thumbnail,
      instructorName:
        'instructor' in course && course.instructor
          ? course.instructor.name
          : 'instructorName' in course
          ? course.instructorName
          : 'Edufy Instructor',
    };

    setCart((prev) => [...prev, item]);
    showToast(`Added "${course.title}" to cart`, 'success');
    setIsCartOpen(true);
  };

  const removeFromCart = (courseId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== courseId));
    showToast('Course removed from cart', 'info');
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('edufy_cart');
  };

  const showToast = (
    message: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'success'
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const isInWishlist = (courseId: string): boolean => {
    return wishlist.includes(courseId);
  };

  const isEnrolled = (courseId: string): boolean => {
    return enrolledCourseIds.includes(courseId);
  };

  const toggleWishlist = async (courseId: string, courseTitle?: string) => {
    const exists = wishlist.includes(courseId);

    if (exists) {
      setWishlist((prev) => prev.filter((id) => id !== courseId));
      showToast(courseTitle ? `Removed "${courseTitle}" from wishlist` : 'Removed from wishlist', 'info');

      if (isSupabaseConfigured && currentUser) {
        await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('course_id', courseId);
      }
    } else {
      setWishlist((prev) => [...prev, courseId]);
      showToast(courseTitle ? `Saved "${courseTitle}" to wishlist` : 'Saved to wishlist', 'success');

      if (isSupabaseConfigured && currentUser) {
        await supabase
          .from('wishlists')
          .insert({ user_id: currentUser.id, course_id: courseId });
      }
    }
  };

  /**
   * Secure Razorpay Server-Side Order Creation & Verification
   * Never grants course access based solely on frontend events.
   * Signature is verified server-side using HMAC SHA-256 before granting enrollment.
   */
  const initiateCourseEnrollment = async (
    course: Course | { id: string; title: string; price: number }
  ): Promise<boolean> => {
    if (isEnrolled(course.id)) {
      showToast('You already have lifetime access to this course', 'info');
      return true;
    }

    if (!currentUser) {
      showToast('Please sign in or create an account to enroll', 'warning');
      return false;
    }

    setIsProcessingPayment(true);
    showToast('Initializing secure Razorpay payment order...', 'info');

    try {
      const token = await getAuthToken();

      // Step 1: Create Order on Express Server
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          courseId: course.id,
          currency: 'INR',
        }),
      });

      if (!orderRes.ok) {
        const errJson = await orderRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to create payment order on server.');
      }

      const orderData = await orderRes.json();
      const { orderId, amount, currency, keyId, courseTitle, user } = orderData;

      // Step 2: Load Razorpay SDK
      const scriptLoaded = await loadRazorpayScript();

      return new Promise<boolean>((resolve) => {
        // If Razorpay SDK is available and we have a valid key or live checkout
        if (scriptLoaded && typeof (window as any).Razorpay === 'function' && keyId && !orderId.startsWith('order_test_')) {
          const razorpayOptions = {
            key: keyId,
            amount,
            currency,
            name: 'Edufy Academy',
            description: courseTitle || course.title,
            image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=128&auto=format&fit=crop&q=80',
            order_id: orderId,
            prefill: {
              name: user?.name || currentUser.name,
              email: user?.email || currentUser.email,
            },
            theme: {
              color: '#004AAD',
            },
            modal: {
              ondismiss: () => {
                setIsProcessingPayment(false);
                showToast('Payment window cancelled.', 'info');
                resolve(false);
              },
            },
            // CRITICAL STEP: Server-Side Signature Verification Handler
            handler: async (response: {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            }) => {
              try {
                showToast('Verifying payment signature securely with server...', 'info');

                const verifyRes = await fetch('/api/payments/verify-payment', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    course_id: course.id,
                  }),
                });

                const verifyResult = await verifyRes.json();

                if (!verifyRes.ok || !verifyResult.success) {
                  throw new Error(verifyResult.error || 'Cryptographic payment verification failed.');
                }

                // Granted only after server verification
                setEnrolledCourseIds((prev) => [...prev, course.id]);
                setIsProcessingPayment(false);
                showToast(`Payment verified! You are now enrolled in "${course.title}".`, 'success');
                resolve(true);
              } catch (verifyErr: any) {
                console.error('[Payment Verification Error]:', verifyErr);
                setIsProcessingPayment(false);
                showToast(verifyErr.message || 'Payment verification failed.', 'error');
                resolve(false);
              }
            },
          };

          const rzp = new (window as any).Razorpay(razorpayOptions);
          rzp.open();
        } else {
          // Development/Testing fallback with server-side signature verification simulation
          // Executes the exact same server-side verification endpoint
          setTimeout(async () => {
            try {
              const testPaymentId = `pay_test_${Date.now()}`;
              showToast('Running server-side signature verification & transactional enrollment...', 'info');

              const verifyRes = await fetch('/api/payments/verify-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  razorpay_order_id: orderId,
                  razorpay_payment_id: testPaymentId,
                  razorpay_signature: 'test_verified_signature',
                  course_id: course.id,
                }),
              });

              const verifyResult = await verifyRes.json();
              if (verifyRes.ok && verifyResult.success) {
                setEnrolledCourseIds((prev) => [...prev, course.id]);
                setIsProcessingPayment(false);
                showToast(`Enrolled successfully in "${course.title}"!`, 'success');
                resolve(true);
              } else {
                throw new Error(verifyResult.error || 'Server rejected verification');
              }
            } catch (simErr: any) {
              console.error('[Verification Error]:', simErr);
              setIsProcessingPayment(false);
              showToast(simErr.message || 'Payment simulation failed.', 'error');
              resolve(false);
            }
          }, 700);
        }
      });
    } catch (err: any) {
      console.error('[Checkout Error]:', err);
      setIsProcessingPayment(false);
      showToast(err.message || 'Unable to process checkout. Please try again.', 'error');
      return false;
    }
  };

  /**
   * Multi-item Cart Checkout via Razorpay
   */
  const initiateCartCheckout = async (): Promise<boolean> => {
    if (cart.length === 0) {
      showToast('Your shopping cart is empty', 'warning');
      return false;
    }

    if (!currentUser) {
      showToast('Please sign in or create an account to complete checkout', 'warning');
      return false;
    }

    const pendingCartItems = cart.filter((item) => !isEnrolled(item.id));
    if (pendingCartItems.length === 0) {
      showToast('You already own all courses in this cart!', 'info');
      clearCart();
      setIsCartOpen(false);
      return true;
    }

    setIsProcessingPayment(true);
    showToast(`Initializing Razorpay checkout for ${pendingCartItems.length} courses...`, 'info');

    try {
      const token = await getAuthToken();
      const courseIds = pendingCartItems.map((i) => i.id);

      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          courseIds,
          currency: 'INR',
        }),
      });

      if (!orderRes.ok) {
        const errJson = await orderRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to create payment order on server.');
      }

      const orderData = await orderRes.json();
      const { orderId, amount, currency, keyId, courseTitle, user } = orderData;
      const scriptLoaded = await loadRazorpayScript();

      return new Promise<boolean>((resolve) => {
        if (scriptLoaded && typeof (window as any).Razorpay === 'function' && keyId && !orderId.startsWith('order_test_')) {
          const razorpayOptions = {
            key: keyId,
            amount,
            currency,
            name: 'Edufy Academy',
            description: courseTitle,
            image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=128&auto=format&fit=crop&q=80',
            order_id: orderId,
            prefill: {
              name: user?.name || currentUser.name,
              email: user?.email || currentUser.email,
            },
            theme: {
              color: '#004AAD',
            },
            modal: {
              ondismiss: () => {
                setIsProcessingPayment(false);
                showToast('Payment window closed.', 'info');
                resolve(false);
              },
            },
            handler: async (response: {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            }) => {
              try {
                showToast('Verifying payment signature securely with server...', 'info');

                const verifyRes = await fetch('/api/payments/verify-payment', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    course_ids: courseIds,
                  }),
                });

                const verifyResult = await verifyRes.json();
                if (!verifyRes.ok || !verifyResult.success) {
                  throw new Error(verifyResult.error || 'Cryptographic payment verification failed.');
                }

                setEnrolledCourseIds((prev) => [...new Set([...prev, ...courseIds])]);
                clearCart();
                setIsCartOpen(false);
                setIsProcessingPayment(false);
                showToast(`Payment verified! Enrolled in ${courseIds.length} course(s).`, 'success');
                resolve(true);
              } catch (verifyErr: any) {
                console.error('[Payment Verification Error]:', verifyErr);
                setIsProcessingPayment(false);
                showToast(verifyErr.message || 'Payment verification failed.', 'error');
                resolve(false);
              }
            },
          };

          const rzp = new (window as any).Razorpay(razorpayOptions);
          rzp.open();
        } else {
          // Dev test fallback with server-side signature verification
          setTimeout(async () => {
            try {
              const testPaymentId = `pay_test_${Date.now()}`;
              showToast('Verifying payment signature & granting multi-course enrollment...', 'info');

              const verifyRes = await fetch('/api/payments/verify-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  razorpay_order_id: orderId,
                  razorpay_payment_id: testPaymentId,
                  razorpay_signature: 'test_verified_signature',
                  course_ids: courseIds,
                }),
              });

              const verifyResult = await verifyRes.json();
              if (verifyRes.ok && verifyResult.success) {
                setEnrolledCourseIds((prev) => [...new Set([...prev, ...courseIds])]);
                clearCart();
                setIsCartOpen(false);
                setIsProcessingPayment(false);
                showToast(`Enrolled successfully in ${courseIds.length} course(s)!`, 'success');
                resolve(true);
              } else {
                throw new Error(verifyResult.error || 'Server rejected verification');
              }
            } catch (simErr: any) {
              console.error('[Verification Error]:', simErr);
              setIsProcessingPayment(false);
              showToast(simErr.message || 'Payment simulation failed.', 'error');
              resolve(false);
            }
          }, 700);
        }
      });
    } catch (err: any) {
      console.error('[Checkout Error]:', err);
      setIsProcessingPayment(false);
      showToast(err.message || 'Unable to process checkout. Please try again.', 'error');
      return false;
    }
  };

  return (
    <CartWishlistContext.Provider
      value={{
        wishlist,
        cart,
        cartCount,
        cartSubtotal,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        clearCart,
        isInCart,
        enrolledCourseIds,
        isProcessingPayment,
        isInWishlist,
        toggleWishlist,
        isEnrolled,
        initiateCourseEnrollment,
        initiateCartCheckout,
        refreshUserData,
        toasts,
        showToast,
        removeToast,
      }}
    >
      {children}
    </CartWishlistContext.Provider>
  );
};

export const useCartWishlist = () => {
  const context = useContext(CartWishlistContext);
  if (!context) {
    throw new Error('useCartWishlist must be used within a CartWishlistProvider');
  }
  return context;
};
