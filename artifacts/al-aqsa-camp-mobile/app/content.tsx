import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, ScrollView, Text, ActivityIndicator, Pressable } from 'react-native';
import { ScreenHeader, Card, fonts, StatusPill } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useListContent, getListContentQueryKey } from '@workspace/api-client-react';
import { useApp } from '@/context/AppContext';

export default function ContentScreen() {
  const colors = useColors();
  const { user, signedIn } = useApp();
  
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  
  const { data: contentPage, isLoading, isError, refetch } = useListContent(undefined, {
    query: { enabled: isManager, queryKey: getListContentQueryKey() }
  });

  const posts = contentPage?.items || [];

  if (!signedIn || !isManager) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="الإعلانات والمحتوى" />
        <View style={styles.center}><Text style={[styles.errorText, { color: colors.destructive }]}>هذه الصفحة مخصصة لمدراء النظام فقط.</Text></View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader 
        title="الإعلانات والمحتوى" 
        subtitle="إدارة الأخبار والتحديثات"
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}
        
        {isError && (
          <Card style={styles.center}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>تعذر جلب الإعلانات.</Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: 10 }}>
              <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>إعادة المحاولة</Text>
            </Pressable>
          </Card>
        )}

        {!isLoading && !isError && posts.length === 0 && (
          <Card style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>لا توجد إعلانات مسجلة.</Text>
          </Card>
        )}

        {!isLoading && !isError && posts.map(post => (
          <Card key={post.id} style={styles.card}>
            <View style={styles.header}>
              <StatusPill text={post.status === 'published' ? 'منشور' : 'مسودة'} tone={post.status === 'published' ? 'green' : 'gold'} />
              <Text style={[styles.title, { color: colors.foreground }]}>{post.title}</Text>
            </View>
            <View style={styles.details}>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{new Date(post.createdAt).toLocaleDateString('ar')}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 16, textAlign: 'right', marginLeft: 12 },
  details: { marginTop: 12, alignItems: 'flex-start' },
  meta: { fontFamily: fonts.regular, fontSize: 13 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 16, textAlign: 'center' },
});