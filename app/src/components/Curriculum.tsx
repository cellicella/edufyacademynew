import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, type } from '@/theme';
import { Lesson, Section } from '@/lib/types';
import { formatMinutes } from '@/utils/format';

const lessonIcon = (l: Lesson): keyof typeof Ionicons.glyphMap => (l.type === 'quiz' ? 'help-circle-outline' : l.type === 'article' ? 'document-text-outline' : 'play-circle-outline');

/** Accordion curriculum used on course details and inside the player. */
export const Curriculum: React.FC<{
  sections: Section[];
  activeLessonId?: string | null;
  completed?: Set<string>;
  canOpen?: (l: Lesson) => boolean;
  onOpen?: (l: Lesson) => void;
  initiallyOpen?: number;
  dark?: boolean;
}> = ({ sections, activeLessonId, completed, canOpen, onOpen, initiallyOpen = 1 }) => {
  const activeSection = sections.findIndex((s) => s.lessons.some((l) => l.id === activeLessonId));
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s, i) => [s.id, i < initiallyOpen || i === activeSection]))
  );

  return (
    <View style={{ gap: 10 }}>
      {sections.map((s, si) => {
        const mins = s.lessons.reduce((n, l) => n + (l.durationMinutes || 0), 0);
        const done = completed ? s.lessons.filter((l) => completed.has(l.id)).length : 0;
        const isOpen = !!open[s.id];
        return (
          <View key={s.id} style={styles.section}>
            <Pressable onPress={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))} style={styles.sectionHead} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
              <View style={{ flex: 1 }}>
                <Text style={type.eyebrow}>Section {si + 1}</Text>
                <Text style={[type.h3, { fontSize: 15.5, marginTop: 2 }]}>{s.title}</Text>
                <Text style={[type.small, { marginTop: 2 }]}>
                  {s.lessons.length} lessons · {formatMinutes(mins)}{completed ? ` · ${done}/${s.lessons.length} done` : ''}
                </Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
            </Pressable>
            {isOpen &&
              s.lessons.map((l, li) => {
                const openable = canOpen ? canOpen(l) : false;
                const active = l.id === activeLessonId;
                const isDone = completed?.has(l.id);
                return (
                  <Pressable
                    key={l.id}
                    disabled={!openable || !onOpen}
                    onPress={() => onOpen?.(l)}
                    style={[styles.lesson, active && { backgroundColor: colors.primarySoft }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${l.title}${isDone ? ', completed' : ''}${!openable ? ', locked' : ''}`}
                  >
                    <View style={[styles.lessonIcon, isDone && { backgroundColor: colors.successSoft }]}>
                      <Ionicons name={isDone ? 'checkmark' : lessonIcon(l)} size={17} color={isDone ? colors.success : active ? colors.primary : colors.muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.body, { color: active ? colors.primary : colors.ink, fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular' }]} numberOfLines={2}>
                        {li + 1}. {l.title}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 }}>
                        <Text style={type.small}>{l.type === 'video' ? 'Video' : l.type === 'article' ? 'Article' : 'Quiz'} · {formatMinutes(l.durationMinutes)}</Text>
                        {l.isFreePreview && <Text style={[type.small, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>Preview</Text>}
                      </View>
                    </View>
                    {!openable && <Ionicons name="lock-closed" size={15} color={colors.subtle} />}
                  </Pressable>
                );
              })}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  section: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.hairline },
  lessonIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
