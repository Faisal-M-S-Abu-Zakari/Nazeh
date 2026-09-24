import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Card, fonts, ScreenHeader, StatusPill, SyncBanner } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

export default function PeopleScreen() {
  const colors = useColors();
  const { people, signedIn, canManagePeople } = useApp();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => people.filter((person) => person.name.includes(query) || person.role.includes(query)), [people, query]);
  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader title="سجل المخيم" subtitle="سجل النازحين المشترك" action={canManagePeople ? <Pressable testID="add-person" onPress={() => router.push('/add-person')}><Ionicons name="person-add" size={26} color={colors.primary} /></Pressable> : undefined} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SyncBanner scope="people" />
        <View style={[styles.search, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput testID="people-search" value={query} onChangeText={setQuery} placeholder="ابحث بالاسم أو الدور" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} textAlign="right" />
          <Ionicons name="search" size={20} color={colors.primary} />
        </View>
        {filtered.length === 0 ? <Card><Ionicons name="search-outline" size={30} color={colors.mutedForeground} style={styles.emptyIcon} /><Text style={[styles.empty, { color: colors.mutedForeground }]}>لا توجد نتائج مطابقة</Text></Card> : filtered.map((person) => (
          <Pressable testID={`open-person-${person.id}`} key={person.id} onPress={() => router.push({ pathname: '/person/[id]', params: { id: person.id } } as never)}>
            <Card>
            <View style={styles.row}>
              <StatusPill text={person.role} tone={person.role === 'نازح' ? 'gold' : 'green'} />
              <View style={styles.person}>
                <Text style={[styles.name, { color: colors.foreground }]}>{person.name}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>{person.location} · {person.phone}</Text>
              </View>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}><Ionicons name="person" size={22} color={colors.primary} /></View>
            </View>
            </Card>
          </Pressable>
        ))}
        {signedIn && !canManagePeople ? <Text style={[styles.empty, { color: colors.destructive }]}>دور حسابك يسمح بعرض السجل فقط.</Text> : null}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1 }, content: { padding: 16, paddingBottom: 118, gap: 10 },
  search: { height: 50, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  person: { flex: 1, alignItems: 'flex-end' }, name: { fontFamily: fonts.bold, fontSize: 16 },
  meta: { fontFamily: fonts.regular, fontSize: 12, marginTop: 4, textAlign: 'right' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: fonts.regular, textAlign: 'center', marginTop: 8 }, emptyIcon: { alignSelf: 'center' },
});