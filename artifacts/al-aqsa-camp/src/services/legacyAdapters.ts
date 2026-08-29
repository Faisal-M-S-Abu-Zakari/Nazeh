import type {
  ManagedAid as ApiAid,
  ManagedComplaint as ApiComplaint,
  ContentPost,
  DisplacedPerson,
  Notification as ApiNotification,
  SecurityTask,
} from "@workspace/api-client-react";
import { ComplaintStatus } from "@workspace/api-client-react";
import type { Aid } from "@/@types/actors/manager/aid-management/add-aid-management.types";
import type { Complaint } from "@/@types/actors/general/Complaints/ComplaintsResponse.type";
import type { Displaced } from "@/@types/actors/general/displaceds/displacesResponse.type";
import type { DisplacedProfile } from "@/@types/actors/displaced/profile/displacedProfileResponse.type";
import { NotificationStatus, type NotificationItem } from "@/@types/actors/general/notification/notificationResponse.type";
import type { Task } from "@/@types/actors/security/tasks/TasksResponse.type";
import type { AdBlogStory } from "@/@types/actors/manager/ads-blogs-stories/adsBlogsStoriesResponse.type";
import {
  COMPLAINTS_STATUS,
  ACCOMMODATION_TYPE,
  AGES,
  DISTRIBUTION_MECHANISM,
  DISTRIBUTION_METHOD,
  QUANTITY_AVAILABILITY,
  FAMILY_STATUS_TYPE,
  GENDER,
  SOCIAL_STATUS,
  TASKS_TABS,
  TYPE_AIDS,
  TYPE_GROUP_AIDS,
  TYPE_WRITTEN_CONTENT,
} from "@/@types/actors/common-types/index.type";
import { USER_TYPE, type UserRank, type UserType } from "@/constants/userTypes";

const aidStatus: Record<ApiAid["status"], TYPE_GROUP_AIDS> = {
  planned: TYPE_GROUP_AIDS.COMING_AIDS,
  active: TYPE_GROUP_AIDS.ONGOING_AIDS,
  completed: TYPE_GROUP_AIDS.PREVIOUS_AIDS,
  cancelled: TYPE_GROUP_AIDS.PREVIOUS_AIDS,
};

export const toApiAidStatus = (status: TYPE_GROUP_AIDS): ApiAid["status"] => ({
  [TYPE_GROUP_AIDS.COMING_AIDS]: "planned",
  [TYPE_GROUP_AIDS.ONGOING_AIDS]: "active",
  [TYPE_GROUP_AIDS.PREVIOUS_AIDS]: "completed",
})[status] as ApiAid["status"];

export const toLegacyAid = (aid: ApiAid): Aid => ({
  id: aid.id,
  aid_name: aid.title,
  aid_type: Object.values(TYPE_AIDS).includes(aid.type as TYPE_AIDS)
    ? (aid.type as TYPE_AIDS)
    : TYPE_AIDS.OTHER_AID,
  aid_content: aid.description ?? "",
  delivery_date: aid.distributionDate ? new Date(aid.distributionDate) : null,
  delivery_location: "",
  security_required: false,
  quantity_availability:
    aid.quantity > 0 ? QUANTITY_AVAILABILITY.LIMITED : QUANTITY_AVAILABILITY.UNLIMITED,
  existing_quantity: aid.quantity,
  displaced_single_portion: 1,
  selected_categories: [],
  distribution_method: DISTRIBUTION_METHOD.EQUAL,
  distribution_mechanism: DISTRIBUTION_MECHANISM.DISPLACED_FAMILIES,
  selected_displaced_Ids: [],
  selected_delegates_portions: [],
  received_displaceds: [],
  security_men: [],
  is_completed: aid.status === "completed",
  aid_status: aidStatus[aid.status],
  additional_notes: "",
});

export const toLegacyComplaint = (
  complaint: ApiComplaint,
  actorId: number,
  role: UserType | UserRank,
): Complaint => {
  const current = { id: actorId, name: "المستخدم الحالي", image: "", role };
  const displaced = {
    id: complaint.displacedPersonId ?? 0,
    name: "صاحب الشكوى",
    image: "",
    role: USER_TYPE.DISPLACED,
  };
  return {
    id: complaint.id,
    date: new Date(complaint.createdAt).toISOString().slice(0, 10),
    sender: role === USER_TYPE.DISPLACED ? current : displaced,
    receiver: role === USER_TYPE.DISPLACED ? { ...current, role: USER_TYPE.MANAGER } : current,
    title: complaint.subject,
    body: complaint.message,
    // Keep a real lifecycle state even when this legacy list endpoint is used.
    status: ({
      open: ComplaintStatus.OPEN,
      inProgress: ComplaintStatus.IN_REVIEW,
      resolved: ComplaintStatus.RESOLVED,
      closed: ComplaintStatus.REJECTED,
    } as const)[complaint.status],
  };
};

export const toLegacyDisplaced = (person: DisplacedPerson): Displaced => ({
  id: person.id,
  name: person.name,
  identity: person.nationalId ?? "",
  tent: person.location ?? "",
  family_number: person.familySize,
  mobile_number: person.phone,
  delegate: {
    id: person.delegateId ?? 0,
    name: person.delegateId == null ? "غير معين" : `مندوب رقم ${person.delegateId}`,
  },
});

export const toLegacyDisplacedProfile = (person: DisplacedPerson): DisplacedProfile => ({
  id: person.id,
  name: person.name,
  email: "",
  gender: GENDER.MALE,
  profile_image: "",
  identity: person.nationalId ?? "",
  nationality: "",
  original_address: person.location ?? "",
  phone_number: person.phone,
  alternative_phone_number: undefined,
  wives: [],
  social_status: {
    status: SOCIAL_STATUS.SINGLE,
    number_of_wives: 0,
    number_of_males: 0,
    number_of_females: 0,
    total_family_members: person.familySize,
    age_groups: Object.fromEntries(Object.values(AGES).map((age) => [age, 0])) as Record<AGES, number>,
  },
  displacement: {
    tent_number: person.location ?? "",
    tent_type: ACCOMMODATION_TYPE.OUTDOOR,
    family_status_type: FAMILY_STATUS_TYPE.NORMAL,
    displacement_date: person.createdAt,
    delegate: {
      id: String(person.delegateId ?? ""),
      name: person.delegateId == null ? "غير معين" : `مندوب رقم ${person.delegateId}`,
    },
  },
  war_injuries: [],
  martyrs: [],
  medical_conditions: [],
  role: USER_TYPE.DISPLACED,
  rank: USER_TYPE.DISPLACED,
  additional_notes: "",
});

export const toLegacyNotification = (notification: ApiNotification): NotificationItem => ({
  id: notification.id,
  dateTime: new Date(notification.createdAt),
  title: notification.title,
  body: notification.message,
  status: notification.read ? NotificationStatus.READ : NotificationStatus.UNREAD,
  notification_type: { action: "another-notification" },
  from: { id: 0, name: "إدارة المخيم", role: USER_TYPE.MANAGER },
});

export const toLegacyTask = (task: SecurityTask): Task => ({
  id: task.id,
  dateTime: new Date(task.dueAt ?? task.createdAt),
  title: task.title,
  body: task.description ?? "",
  security_men: task.assignedToId == null ? [] : [task.assignedToId],
  type: task.status === "completed" ? TASKS_TABS.COMPLETED_TASKS : TASKS_TABS.UPCOMING_TASKS,
});

export const toLegacyContent = (
  post: ContentPost,
  type: TYPE_WRITTEN_CONTENT,
): AdBlogStory => ({
  id: post.id,
  title: post.title,
  content: post.body,
  brief: "",
  imgs: post.imageUrl ? [post.imageUrl] : [],
  created_at: new Date(post.createdAt),
  updated_at: new Date(post.updatedAt),
  type,
});