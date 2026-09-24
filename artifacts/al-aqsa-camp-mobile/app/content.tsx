import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListContentQueryKey,
  useCreateContentPost,
  useListContent,
  useUpdateContentPost,
} from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Card, Field, fonts, PrimaryButton, ScreenHeader, StatusPill } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { getMutationErrorMessage } from '@/lib/mutationErrors';
import { useColors } from '@/hooks/useColors';

type ContentStatus = 'draft' | 'published';
type ContentPost = {
  id: number;
  title: string;
  body: string;
  imageUrl?: string | null;
  status: ContentStatus;
  createdAt: string;
  publishedAt?: string | null;
};

function validateContent(title: string, body: string, imageUrl: string): string | null {
  if (!title.trim()) return 'أدخل عنوان المحتوى.';
  if (!body.trim()) return 'أدخل نص المحتوى.';
  if (imageUrl.trim()) {
    try {
      const url = new URL(imageUrl.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return 'يجب أن يبدأ رابط الصورة بـ https:// أو http://.';
      }
    } catch {
      return 'تحقق من صيغة رابط الصورة.';
    }
  }
  return null;
}

export default function ContentScreen() {
  const colors = useColors();
  const { user, signedIn } = useApp();
  const queryClient = useQueryClient();
  const isManager = signedIn && user?.role === 'MANAGER';
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ContentPost | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const contentQuery = useListContent({ limit: 100 }, {
    query: {
      enabled: isManager,
      queryKey: getListContentQueryKey({ limit: 100 }),
    },
  });
  const createPost = useCreateContentPost();
  const updatePost = useUpdateContentPost();
  const isSaving = createPost.isPending || updatePost.isPending;
  const posts = (contentQuery.data?.items ?? []) as ContentPost[];
  const filteredPosts = posts.filter((post) => post.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  const closeEditor = () => {
    setIsCreating(false);
    setEditing(null);
    setTitle('');
    setBody('');
    setImageUrl('');
    setValidationError(null);
    setMutationError(null);
  };

  const beginCreate = () => {
    closeEditor();
    setIsCreating(true);
  };

  const beginEdit = (post: ContentPost) => {
    setIsCreating(false);
    setEditing(post);
    setTitle(post.title);
    setBody(post.body);
    setImageUrl(post.imageUrl ?? '');
    setValidationError(null);
    setMutationError(null);
  };

  const saveContent = async (status?: ContentStatus) => {
    const error = validateContent(title, body, imageUrl);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setMutationError(null);
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const cleanImageUrl = imageUrl.trim();
    try {
      if (editing) {
        await updatePost.mutateAsync({
          id: editing.id,
          data: {
            title: cleanTitle,
            body: cleanBody,
            imageUrl: cleanImageUrl || null,
            ...(status ? { status } : {}),
          },
        });
      } else {
        await createPost.mutateAsync({
          data: {
            title: cleanTitle,
            body: cleanBody,
            ...(cleanImageUrl ? { imageUrl: cleanImageUrl } : {}),
            ...(status ? { status } : {}),
          },
        });
      }
      await queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
      closeEditor();
    } catch (error) {
      setMutationError(getMutationErrorMessage(error));
    }
  };

  const publishPost = async (post: ContentPost) => {
    setMutationError(null);
    try {
      await updatePost.mutateAsync({ id: post.id, data: { status: 'published' } });
      await queryClient.invalidateQueries({ queryKey: getListContentQueryKey() });
    } catch (error) {
      setMutationError(getMutationErrorMessage(error));
    }
  };

  if (!isManager) {
    return (
      <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
        <ScreenHeader title="الإعلانات والمحتوى" />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={30} color={colors.destructive} />
          <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>
            {signedIn ? 'هذه الصفحة مخصصة لمدير المخيم فقط.' : 'سجّل الدخول بحساب مدير المخيم للوصول إلى المحتوى.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: colors.surfaceTint }]}>
      <ScreenHeader
        title={isCreating ? 'إضافة محتوى' : editing ? 'تعديل المحتوى' : 'الإعلانات والمحتوى'}
        subtitle={isCreating || editing ? 'أدخل تفاصيل المحتوى ثم احفظ التغييرات' : 'إدارة الأخبار والتحديثات'}
      />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: Platform.OS === 'web' ? 34 : 24 }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={72}
      >
        {isCreating || editing ? (
          <Card style={styles.formCard}>
            <Field
              label="العنوان"
              value={title}
              onChangeText={(value) => { setTitle(value); setValidationError(null); }}
              placeholder="عنوان الخبر أو التقرير"
              accessibilityLabel="عنوان المحتوى"
              testID="content-title"
              maxLength={240}
              returnKeyType="next"
            />
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>رابط الصورة (اختياري)</Text>
              <TextInput
                value={imageUrl}
                onChangeText={(value) => { setImageUrl(value); setValidationError(null); }}
                placeholder="https://example.com/image.jpg"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="رابط الصورة، اختياري"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                textAlign="left"
                testID="content-image-url"
                style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>محتوى المقال</Text>
              <TextInput
                value={body}
                onChangeText={(value) => { setBody(value); setValidationError(null); }}
                placeholder="اكتب تفاصيل المحتوى هنا..."
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="نص المحتوى"
                multiline
                textAlign="right"
                textAlignVertical="top"
                testID="content-body"
                style={[styles.input, styles.bodyInput, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
              />
            </View>
            {validationError ? (
              <Text accessibilityRole="alert" style={[styles.inlineError, { color: colors.destructive }]}>{validationError}</Text>
            ) : null}
            {mutationError ? (
              <Text accessibilityRole="alert" style={[styles.inlineError, { color: colors.destructive }]}>{mutationError}</Text>
            ) : null}
            {isSaving ? (
              <View style={styles.saving}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>جارٍ حفظ المحتوى...</Text>
              </View>
            ) : null}
            <PrimaryButton
              label={editing ? 'حفظ التعديلات' : 'حفظ كمسودة'}
              icon="save-outline"
              onPress={() => void saveContent()}
              disabled={isSaving}
              testID="content-save"
            />
            <PrimaryButton
              label={editing ? 'حفظ ونشر' : 'نشر الآن'}
              icon="paper-plane-outline"
              onPress={() => void saveContent('published')}
              disabled={isSaving}
              testID="content-publish"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إلغاء والعودة إلى قائمة المحتوى"
              testID="content-cancel"
              onPress={closeEditor}
              style={styles.cancelButton}
            >
              <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>إلغاء</Text>
            </Pressable>
          </Card>
        ) : (
          <>
            <PrimaryButton label="إضافة محتوى جديد" icon="add-circle-outline" onPress={beginCreate} testID="content-create" />
            <Card style={styles.searchCard}>
              <Text style={[styles.label, { color: colors.foreground }]}>البحث في العناوين</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث عن محتوى..."
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="البحث في عناوين المحتوى"
                returnKeyType="search"
                testID="content-search"
                style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.background }]}
              />
            </Card>
            {contentQuery.isLoading ? (
              <ActivityIndicator accessibilityLabel="جارٍ تحميل المحتوى" size="large" color={colors.primary} style={styles.loader} />
            ) : null}
            {contentQuery.isError ? (
              <Card style={styles.center}>
                <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>تعذر جلب المحتوى.</Text>
                <Pressable accessibilityRole="button" testID="content-retry" onPress={() => void contentQuery.refetch()} style={styles.retryButton}>
                  <Text style={[styles.retryText, { color: colors.primary }]}>إعادة المحاولة</Text>
                </Pressable>
              </Card>
            ) : null}
            {!contentQuery.isLoading && !contentQuery.isError && filteredPosts.length === 0 ? (
              <Card style={styles.center}>
                <Ionicons name="document-text-outline" size={30} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {posts.length === 0 ? 'لا توجد إعلانات مسجلة بعد.' : 'لا توجد نتائج مطابقة للبحث.'}
                </Text>
              </Card>
            ) : null}
            {!contentQuery.isError && filteredPosts.map((post) => (
              <Card key={post.id} style={styles.postCard}>
                <View style={styles.postHeading}>
                  <StatusPill text={post.status === 'published' ? 'منشور' : 'مسودة'} tone={post.status === 'published' ? 'green' : 'gold'} />
                  <Text style={[styles.title, { color: colors.foreground }]}>{post.title}</Text>
                </View>
                <Text numberOfLines={4} style={[styles.bodyPreview, { color: colors.mutedForeground }]}>{post.body}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  أُنشئ في {new Date(post.createdAt).toLocaleDateString('ar')}
                  {post.publishedAt ? ` · نُشر في ${new Date(post.publishedAt).toLocaleDateString('ar')}` : ''}
                </Text>
                <View style={[styles.actions, { borderTopColor: colors.border }]}>
                  {post.status === 'draft' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`نشر ${post.title}`}
                      testID={`content-publish-${post.id}`}
                      disabled={updatePost.isPending}
                      onPress={() => void publishPost(post)}
                      style={[styles.actionButton, { borderColor: colors.primary }]}
                    >
                      <Ionicons name="paper-plane-outline" size={17} color={colors.primary} />
                      <Text style={[styles.actionText, { color: colors.primary }]}>نشر</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`تعديل ${post.title}`}
                    testID={`content-edit-${post.id}`}
                    onPress={() => beginEdit(post)}
                    style={[styles.actionButton, { borderColor: colors.border }]}
                  >
                    <Ionicons name="create-outline" size={18} color={colors.foreground} />
                    <Text style={[styles.actionText, { color: colors.foreground }]}>تعديل</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
            {mutationError ? (
              <Text accessibilityRole="alert" style={[styles.inlineError, { color: colors.destructive }]}>{mutationError}</Text>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, gap: 12 },
  formCard: { gap: 16 },
  field: { gap: 7 },
  label: { fontFamily: fonts.bold, textAlign: 'right', fontSize: 14 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 16 },
  bodyInput: { minHeight: 180, paddingTop: 12 },
  searchCard: { gap: 8 },
  postCard: { gap: 12 },
  postHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 17, textAlign: 'right' },
  bodyPreview: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, textAlign: 'right' },
  meta: { fontFamily: fonts.regular, fontSize: 12, textAlign: 'right' },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  actionButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { fontFamily: fonts.bold, fontSize: 14 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
  errorText: { fontFamily: fonts.bold, fontSize: 16, textAlign: 'center', lineHeight: 24 },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, textAlign: 'center' },
  retryButton: { padding: 10 },
  retryText: { fontFamily: fonts.bold },
  inlineError: { fontFamily: fonts.bold, fontSize: 14, textAlign: 'right', lineHeight: 21 },
  saving: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 9 },
  cancelButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: fonts.bold, fontSize: 15 },
  loader: { marginTop: 20 },
});