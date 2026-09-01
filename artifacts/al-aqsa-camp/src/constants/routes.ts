
export const LANDING_ROUTES = {
  HOME: '/',
  OUR_SERVICES: '/#our-service',
  CONTACT_US: '#contact-us',
  BLOG: '/blog',
  SUCCESS_STORY: '/success-stories',
} as const;

export const AUTH_ROUTES = {
  LOGIN: '/auth/login',
  FORGET_PASSWORD: '/auth/forget-password',
  OTP: '/auth/otp',
  CREATE_NEW_PASSWORD: '/auth/create-new-password',
} as const;

export const GENERAL_ACTOR_ROUTES = {
  // GENERAL
  ADS: '/actor/ads',
  DELEGATES: '/actor/delegates',
  ADD_DELEGATES: '/actor/delegates/add',
  DISPLACEDS: '/actor/displaceds',
  ADD_DISPLACEDS: '/actor/displaceds/add',
  SECURITIES: '/actor/securities',
  ADD_SECURITIES: '/actor/securities/add',
  NOTIFICATIONS: '/actor/notifications',
  STAFF: '/actor/staff',
  FAMILY: '/actor/family',

} as const;

export const DISPLACED_ROUTES_fUNC = (
  {
    displaced_Id
  }: {
    displaced_Id: number
  }) => {
  return {
    PROFILE: `/actor/displaceds/${displaced_Id}/profile`,
    COMPLAINTS: `/actor/displaceds/${displaced_Id}/complaints`,
    RECEIVED_AIDS: `/actor/displaceds/${displaced_Id}/received-aids`,
  } as const;
};

export const DELEGATE_ROUTES_fUNC = (
  {
    delegate_Id, aid_Id
  }: {
    delegate_Id: number,
    aid_Id?: number
  }
) => {
  return {
    PROFILE: `/actor/delegates/${delegate_Id}/profile`,
    COMPLAINTS: `/actor/delegates/${delegate_Id}/complaints`,
    REPORTS: `/actor/delegates/${delegate_Id}/reports`,

    // AIDS_MANAGEMENT
    AIDS_MANAGEMENT: `/actor/delegates/${delegate_Id}/aids-management`,
    ADD_AID_DISPLACEDS: `/actor/delegates/${delegate_Id}/aids-management/${aid_Id}/add-displaceds`,
    AID: `/actor/delegates/${delegate_Id}/aids-management/${aid_Id}`,
  } as const;
};


export const MANAGER_ROUTES_fUNC = (
  {
    manager_Id,
    aid_Id,
    written_content_Id
  }: {
    manager_Id: number,
    aid_Id?: number,
    written_content_Id?: number
  }
) => {
  return {

    PROFILE: `/actor/manager/${manager_Id}/profile`,
    REPORTS: `/actor/manager/${manager_Id}/reports`,
    COMPLAINTS: `/actor/manager/${manager_Id}/complaints`,

    // ADS_BLOGS
    ADS_BLOGS_STORIES: `/actor/manager/${manager_Id}/ads-blogs-stories`,
    AD_BLOG_STORY: `/actor/manager/${manager_Id}/ads-blogs-stories/${written_content_Id}`,
    ADD_ADS_BLOGS_STORIES: `/actor/manager/${manager_Id}/ads-blogs-stories/add`,


    // AIDS_MANAGEMENT
    AIDS_MANAGEMENT: `/actor/manager/${manager_Id}/aids-management`,
    ADD_AID: `/actor/manager/${manager_Id}/aids-management/add`,
    AID: `/actor/manager/${manager_Id}/aids-management/${aid_Id}`,

  } as const;
};

export const SECURITY_ROUTES_fUNC = (
  { security_Id }: {
    security_Id: number,
  }) => {
  return {
    PROFILE: `/actor/securities/${security_Id}/profile`,
    COMPLAINTS: `/actor/securities/${security_Id}/complaints`,
    TASKS: `/actor/securities/${security_Id}/tasks`,
  } as const;
};