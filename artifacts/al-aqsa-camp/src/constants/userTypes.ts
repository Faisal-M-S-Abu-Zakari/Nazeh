export const USER_TYPE = {
    ADMIN: 'ADMIN',
    DISPLACED: 'DISPLACED',
    DELEGATE: 'DELEGATE',
    MANAGER: 'MANAGER',
    SECURITY: 'SECURITY',
    SECURITY_MEMBER: 'SECURITY_MEMBER',
    SECURITY_OFFICER: 'SECURITY_OFFICER',
} as const;

export type UserType = (typeof USER_TYPE)[keyof typeof USER_TYPE];

export const USER_RANK = {
    ...USER_TYPE,
} as const;

export type UserRank = (typeof USER_RANK)[keyof typeof USER_RANK];

export const USER_RANK_LABELS: Record<UserRank, string> = {
    [USER_RANK.ADMIN]: 'مدير',
    [USER_RANK.DISPLACED]: 'نازح',
    [USER_RANK.DELEGATE]: 'مندوب',
    [USER_RANK.MANAGER]: 'مدير',
    [USER_RANK.SECURITY]: 'فرد الأمن',
    [USER_RANK.SECURITY_MEMBER]: 'فرد الأمن',
    [USER_RANK.SECURITY_OFFICER]: 'مسؤول الأمن',
};

