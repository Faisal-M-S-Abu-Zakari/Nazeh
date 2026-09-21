import type { NeedInput } from '@workspace/api-client-react';

export const NEED_SUBMISSION_ERROR_TITLE = 'تعذر حفظ الاحتياج';
export const NEED_SUBMISSION_ERROR_MESSAGE =
  'لم نتمكن من إرسال طلب الاحتياج. بقيت بياناتك كما هي؛ راجعها وحاول مرة أخرى.';

type NeedMutationCallbacks = {
  onSuccess: () => void;
  onError: () => void;
};

type NeedSubmissionDependencies = {
  mutate: (
    variables: { data: NeedInput },
    callbacks: NeedMutationCallbacks,
  ) => void;
  setSubmitError: (hasError: boolean) => void;
  invalidateNeeds: () => void;
  navigate: (path: string) => void;
};

export function submitNeed(
  values: NeedInput,
  {
    mutate,
    setSubmitError,
    invalidateNeeds,
    navigate,
  }: NeedSubmissionDependencies,
): boolean {
  if (
    !values.familyId ||
    !values.category ||
    !values.title ||
    !values.description ||
    !values.priority
  ) {
    return false;
  }

  setSubmitError(false);
  mutate(
    { data: values },
    {
      onSuccess: () => {
        setSubmitError(false);
        invalidateNeeds();
        navigate('/needs');
      },
      onError: () => {
        setSubmitError(true);
      },
    },
  );

  return true;
}