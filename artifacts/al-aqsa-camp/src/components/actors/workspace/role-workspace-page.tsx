import React from 'react';
import useAuth from '@/hooks/useAuth';
import ProfileSection from './sections/profile-section';
import FamiliesSection from './sections/families-section';
import NeedsSection from './sections/needs-section';
import AidsSection from './sections/aids-section';
import TasksSection from './sections/tasks-section';
import ReportsSection from './sections/reports-section';
import ForbiddenSection from './sections/forbidden-section';
import { LoadingState, ErrorState } from './shared/ui-states';

export interface RoleWorkspacePageProps {
  section: 'profile' | 'families' | 'needs' | 'aids' | 'tasks' | 'reports';
}

export default function RoleWorkspacePage({ section }: RoleWorkspacePageProps) {
  const { isLoading, isAuthenticated, isManager, isDelegate, isSecurityOfficer, isSecurity } = useAuth();

  if (isLoading) return <div dir="rtl"><LoadingState message="التحقق من الهوية..." /></div>;
  if (!isAuthenticated) return <div dir="rtl"><ErrorState message="يجب تسجيل الدخول للوصول إلى مساحة العمل." /></div>;

  const canManageFamilies = isManager || isDelegate;
  const canViewNeeds = canManageFamilies || isSecurityOfficer;
  const canViewTasks = isSecurity || isManager;
  const canViewReports = isManager || isDelegate || isSecurity;

  const renderSection = () => {
    switch (section) {
      case 'profile':
        return <ProfileSection />;
      case 'families':
        return canManageFamilies ? <FamiliesSection /> : <ForbiddenSection section="الأسر" />;
      case 'needs':
        return canViewNeeds ? <NeedsSection /> : <ForbiddenSection section="الاحتياجات" />;
      case 'aids':
        return canManageFamilies ? <AidsSection /> : <ForbiddenSection section="المساعدات" />;
      case 'tasks':
        return canViewTasks ? <TasksSection /> : <ForbiddenSection section="المهام" />;
      case 'reports':
        return canViewReports ? <ReportsSection /> : <ForbiddenSection section="التقارير" />;
      default:
        return <ForbiddenSection section="القسم" />;
    }
  };

  return (
    <div dir="rtl" className="min-h-screen w-full bg-slate-50 px-4 py-6 sm:px-8 animate-in fade-in duration-300">
      <div className="mx-auto max-w-7xl">
        {renderSection()}
      </div>
    </div>
  );
}
