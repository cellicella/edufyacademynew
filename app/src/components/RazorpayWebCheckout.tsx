import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from './Chrome';
import { colors, fonts, radius, type } from '@/theme';
import { config } from '@/lib/config';
import { isExternalPaymentUrl, RazorpaySuccess } from '@/logic/payments';

export type { RazorpaySuccess } from '@/logic/payments';

/**
 * Page origin for the checkout page. It must be OUR origin (never Razorpay's own domain —
 * checkout.js behaves differently when it thinks it is running on checkout.razorpay.com) and a
 * secure (https) context. No request is made to this URL; it only sets the document origin.
 */
const PAGE_ORIGIN = /^https:\/\//.test(config.webUrl) ? config.webUrl : 'https://app.edufyacademy.local';

/**
 * Checkout used when the native Razorpay SDK is not in the build (e.g. Expo Go):
 * Razorpay's standard checkout.js inside a WebView. The result is ALWAYS verified by the server —
 * nothing here grants access.
 */
export const RazorpayWebCheckout: React.FC<{
  visible: boolean;
  options: Record<string, any> | null;
  onSuccess: (r: RazorpaySuccess) => void;
  onFailure: (message: string, cancelled: boolean) => void;
}> = ({ visible, options, onSuccess, onFailure }) => {
  const [opened, setOpened] = useState(false);
  const [popupUrl, setPopupUrl] = useState<string | null>(null);
  const finished = useRef(false);

  const finish = (fn: () => void) => {
    if (finished.current) return; // never report twice (e.g. dismiss after success)
    finished.current = true;
    setOpened(false);
    setPopupUrl(null);
    fn();
  };

  const html = useMemo(() => {
    finished.current = false;
    if (!options) return '';
    const json = JSON.stringify(options).replace(/</g, '\\u003c');
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#F7F9FC;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#64748B;text-align:center;padding:24px;box-sizing:border-box}</style></head>
<body><div id="m">Opening secure checkout…</div>
<script>
(function(){
  var send=function(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o))}catch(e){}};
  window.onerror=function(msg){send({type:'error',stage:'script',message:String(msg)})};
  var timer=setTimeout(function(){send({type:'error',stage:'load',message:'Razorpay checkout did not load within 20 seconds.'})},20000);
  var s=document.createElement('script');
  s.src='https://checkout.razorpay.com/v1/checkout.js';
  s.async=true;
  s.onerror=function(){clearTimeout(timer);send({type:'error',stage:'load',message:'Could not download Razorpay checkout (checkout.razorpay.com).'})};
  s.onload=function(){
    clearTimeout(timer);
    try{
      var o=${json};
      o.handler=function(r){send({type:'success',data:r})};
      o.modal={ondismiss:function(){send({type:'dismiss'})},confirm_close:true,escape:false};
      o.retry={enabled:true,max_count:3};
      var rzp=new Razorpay(o);
      // A failed attempt keeps checkout open so the student can retry with another method.
      rzp.on('payment.failed',function(r){send({type:'attempt_failed',message:(r&&r.error&&r.error.description)||'Payment failed'})});
      rzp.open();
      document.getElementById('m').textContent='';
      send({type:'opened'});
    }catch(e){send({type:'error',stage:'init',message:(e&&e.message)||String(e)})}
  };
  document.head.appendChild(s);
})();
</script></body></html>`;
  }, [options]);

  const handleUrl = (url: string) => {
    if (isExternalPaymentUrl(url)) {
      // UPI apps (GPay/PhonePe/Paytm…) and bank apps — the result returns to checkout.js
      Linking.openURL(url).catch(() => undefined);
      return false;
    }
    return true;
  };

  const cancel = () => finish(() => onFailure('Payment cancelled.', true));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={popupUrl ? () => setPopupUrl(null) : cancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Secure checkout" onBack={popupUrl ? () => setPopupUrl(null) : cancel} />
        {visible && options && (
          <View style={{ flex: 1 }}>
            <WebView
              source={{ html, baseUrl: PAGE_ORIGIN }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              javaScriptCanOpenWindowsAutomatically
              // Bank / 3-D Secure pages open in a pop-up window. Show them in a second WebView on
              // top instead of replacing the checkout page (which would lose the payment result).
              setSupportMultipleWindows
              onOpenWindow={(e) => {
                const url = e.nativeEvent.targetUrl;
                if (url && handleUrl(url)) setPopupUrl(url);
              }}
              onShouldStartLoadWithRequest={(req) => handleUrl(req.url)}
              onMessage={(e) => {
                let msg: any;
                try {
                  msg = JSON.parse(e.nativeEvent.data);
                } catch {
                  return;
                }
                if (msg.type === 'opened') setOpened(true);
                else if (msg.type === 'success') finish(() => onSuccess(msg.data));
                else if (msg.type === 'dismiss') cancel();
                else if (msg.type === 'attempt_failed') setPopupUrl(null); // checkout stays open for retry
                else if (msg.type === 'error') {
                  finish(() =>
                    onFailure(
                      msg.stage === 'load'
                        ? `${msg.message} Check the phone’s internet connection and try again.`
                        : `Razorpay checkout could not start: ${msg.message}`,
                      false
                    )
                  );
                }
              }}
              onError={(e) => finish(() => onFailure(`Checkout page failed to load: ${e.nativeEvent.description || 'network error'}`, false))}
            />
            {!opened && (
              <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={type.small}>Opening Razorpay secure checkout…</Text>
              </View>
            )}
            {!!popupUrl && (
              <View style={StyleSheet.absoluteFill}>
                <View style={styles.popupBar}>
                  <Ionicons name="lock-closed" size={14} color={colors.success} />
                  <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>Bank verification — complete it to return to checkout</Text>
                  <Pressable onPress={() => setPopupUrl(null)} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.done}>Done</Text>
                  </Pressable>
                </View>
                <WebView
                  source={{ uri: popupUrl }}
                  javaScriptEnabled
                  domStorageEnabled
                  thirdPartyCookiesEnabled
                  sharedCookiesEnabled
                  setSupportMultipleWindows={false}
                  onShouldStartLoadWithRequest={(req) => handleUrl(req.url)}
                  // The bank page calls window.close() when finished
                  injectedJavaScript={`window.close=function(){window.ReactNativeWebView.postMessage('close')};true;`}
                  onMessage={(e) => e.nativeEvent.data === 'close' && setPopupUrl(null)}
                />
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.bg },
  popupBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border, borderRadius: radius.xs,
  },
  done: { fontFamily: fonts.bodySemi, color: colors.primary, fontSize: 14 },
});
