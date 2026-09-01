import { UserType, UserRank } from '@/constants/userTypes';
import { StaticImageData } from '@/lib/nextjs-mocks';

export interface User {
    id: number;
    name: string;
    email: string;
    identity: string;
    phone_number: string;
    created_at: Date;
    updated_at?: Date;
    profile_image?: string | string | null;
    role: UserType; // UI role, kept distinct from the server's StaffRole
    rank?: UserRank; // used for permission/access levels
}

export interface loginResponse {
    status: number;
    message?: string;
    token: string;
    user: User;
    error?: string;
}
