import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRY_CODES, CountryCode } from '@/logic/phone';
import { colors, fonts, radius, type } from '@/theme';

/** Mobile number with a country-code picker (India first). */
export const PhoneField: React.FC<{
  country: CountryCode; onCountry: (c: CountryCode) => void; value: string; onChangeText: (v: string) => void; error?: string | null; onSubmitEditing?: () => void;
}> = ({ country, onCountry, value, onChangeText, error, onSubmitEditing }) => {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={type.smallStrong}>Mobile number</Text>
      <View style={[styles.field, focused && { borderColor: colors.primary, backgroundColor: colors.white }, !!error && { borderColor: colors.danger }]}>
        <Pressable onPress={() => setOpen(true)} style={styles.code} accessibilityRole="button" accessibilityLabel={`Country code ${country.code}, ${country.country}. Change`} hitSlop={6}>
          <Text style={{ fontSize: 17 }}>{country.flag}</Text>
          <Text style={styles.codeText}>{country.code}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.muted} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={(v) => onChangeText(v.replace(/[^\d\s-]/g, ''))}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder={country.code === '+91' ? '98765 43210' : 'Mobile number'}
          placeholderTextColor={colors.subtle}
          maxLength={16}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          style={styles.input}
          accessibilityLabel="Mobile number"
        />
      </View>
      {!!error && <Text style={[type.small, { color: colors.danger }]}>{error}</Text>}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Text style={[type.h3, { paddingHorizontal: 20, paddingVertical: 14 }]}>Choose country code</Text>
          <FlatList
            data={COUNTRY_CODES}
            keyExtractor={(c) => c.code}
            renderItem={({ item }) => (
              <Pressable onPress={() => { onCountry(item); setOpen(false); }} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bg }]} accessibilityRole="button">
                <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                <Text style={[type.bodyStrong, { flex: 1 }]}>{item.country}</Text>
                <Text style={[type.body, { color: colors.muted }]}>{item.code}</Text>
                {item.code === country.code && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg, paddingRight: 14 },
  code: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, alignSelf: 'stretch', borderRightWidth: 1, borderRightColor: colors.border },
  codeText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15.5, color: colors.ink, paddingHorizontal: 12, paddingVertical: 12 },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: { maxHeight: '70%', backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
});
