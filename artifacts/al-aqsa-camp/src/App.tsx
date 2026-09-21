import { type ReactNode, useEffect } from 'react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import Providers from '@/providers/providers';
import { Toaster } from '@/components/ui/toaster';

// Layouts
import AuthLayout from '@/app/auth/layout';
import PagesLayout from '@/app/(pages)/layout';
import LandingLayout from '@/app/(pages)/(landing)/layout';
import ActorLayout from '@/app/(pages)/actor/layout';

// Landing Pages
import Page1 from '@/app/(pages)/(landing)/blog/[id]/page';
import Page2 from '@/app/(pages)/(landing)/blog/page';
import Page3 from '@/app/(pages)/(landing)/page';
import Page4 from '@/app/(pages)/(landing)/success-stories/[id]/page';
import Page5 from '@/app/(pages)/(landing)/success-stories/page';

// Actor Pages & Views
import OperationsPage from '@/app/(pages)/actor/operations/page';
import FamilyHeadPage from '@/app/(pages)/actor/family/page';
import {
  FamilyAdsPage,
  FamilyComplaintsPage,
  FamilyNotificationsPage,
  FamilyReceivedAidsPage,
} from '@/components/actors/displaced/family-portal-pages';
import RoleWorkspacePage from '@/components/actors/workspace/role-workspace-page';
import Page40 from '@/app/(pages)/actor/staff/page';

// Auth Pages
import Page36 from '@/app/auth/create-new-password/page';
import Page37 from '@/app/auth/forget-password/page';
import Page38 from '@/app/auth/login/page';
import Page39 from '@/app/auth/otp/page';

import useAuth from '@/hooks/useAuth';
import { AUTH_ROUTES } from '@/constants/routes';
import { canAccessActorPath } from '@/utils/auth/routeAccess';
import { normalizeActorPath } from '@/utils/auth/actorRouting';

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

// Layout wrapper for dynamic wouter nested routes
const LandingPages = () => (
  <LandingLayout>
    <Switch>
      <Route path="/" component={Page3} />
      <Route path="/blog/:id" component={Page1} />
      <Route path="/blog" component={Page2} />
      <Route path="/success-stories/:id" component={Page4} />
      <Route path="/success-stories" component={Page5} />
      <Route component={NotFound} />
    </Switch>
  </LandingLayout>
);

const ActorPages = () => (
  <ActorLayout>
    <Switch>
      <Route path="/operations" component={OperationsPage} />
      <Route path="/family/notifications" component={FamilyNotificationsPage} />
      <Route path="/family/ads" component={FamilyAdsPage} />
      <Route path="/family/received-aids" component={FamilyReceivedAidsPage} />
      <Route path="/family/complaints" component={FamilyComplaintsPage} />
      <Route path="/family" component={FamilyHeadPage} />
      
      {/* Workspace Sections */}
      <Route path="/profile">{(params) => <RoleWorkspacePage section="profile" params={params} />}</Route>
      
      {/* Families */}
      <Route path="/families/new">{(params) => <RoleWorkspacePage section="families" params={params} />}</Route>
      <Route path="/families/:id">{(params) => <RoleWorkspacePage section="families" params={params} />}</Route>
      <Route path="/families">{(params) => <RoleWorkspacePage section="families" params={params} />}</Route>
      
      {/* Needs */}
      <Route path="/needs/new">{(params) => <RoleWorkspacePage section="needs" params={params} />}</Route>
      <Route path="/needs/:id">{(params) => <RoleWorkspacePage section="needs" params={params} />}</Route>
      <Route path="/needs">{(params) => <RoleWorkspacePage section="needs" params={params} />}</Route>
      
      {/* Aids */}
      <Route path="/aids/new">{(params) => <RoleWorkspacePage section="aids" params={params} />}</Route>
      <Route path="/aids/:id">{(params) => <RoleWorkspacePage section="aids" params={params} />}</Route>
      <Route path="/aids">{(params) => <RoleWorkspacePage section="aids" params={params} />}</Route>
      
      {/* Tasks */}
      <Route path="/tasks/new">{(params) => <RoleWorkspacePage section="tasks" params={params} />}</Route>
      <Route path="/tasks/:id">{(params) => <RoleWorkspacePage section="tasks" params={params} />}</Route>
      <Route path="/tasks">{(params) => <RoleWorkspacePage section="tasks" params={params} />}</Route>
      
      {/* Reports */}
      <Route path="/reports">{(params) => <RoleWorkspacePage section="reports" params={params} />}</Route>

      {/* Extra Modules */}
      <Route path="/complaints/:id">{(params) => <RoleWorkspacePage section="complaints" params={params} />}</Route>
      <Route path="/complaints">{(params) => <RoleWorkspacePage section="complaints" params={params} />}</Route>
      <Route path="/notifications">{(params) => <RoleWorkspacePage section="notifications" params={params} />}</Route>
      <Route path="/content/new">{(params) => <RoleWorkspacePage section="content" params={params} />}</Route>
      <Route path="/content/:id">{(params) => <RoleWorkspacePage section="content" params={params} />}</Route>
      <Route path="/content">{(params) => <RoleWorkspacePage section="content" params={params} />}</Route>

      {/* Staff */}
      <Route path="/staff" component={Page40} />

      {/* Fallback to legacy structure or Not Found */}
      <Route component={NotFound} />
    </Switch>
  </ActorLayout>
);

function AuthLoadingScreen() {
  return (
    <div
      data-testid="auth-loading"
      className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground"
      dir="rtl"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span>جارٍ التحقق من جلسة المستخدم...</span>
      </div>
    </div>
  );
}

function AccessDeniedScreen() {
  return (
    <div
      data-testid="access-denied"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center"
      dir="rtl"
    >
      <h1 className="text-xl font-semibold text-destructive">لا تملك صلاحية لهذه الشاشة</h1>
      <p className="text-sm text-muted-foreground">يمكنك الوصول فقط إلى الشاشات المخصصة لدور حسابك.</p>
    </div>
  );
}

function ProtectedActorPages() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading, role, user } = useAuth();
  
  // Wouter matches path exactly. Actor pages base is /actor
  const actorPath = normalizeActorPath(location);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.replace(AUTH_ROUTES.LOGIN);
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) return <AuthLoadingScreen />;
  if (!isAuthenticated || !role || !user) return <AuthLoadingScreen />;
  
  if (!canAccessActorPath(actorPath, { role })) {
    return <AccessDeniedScreen />;
  }
  
  return <ActorPages />;
}

const AuthPages = () => (
  <AuthLayout>
    <Switch>
      <Route path="/create-new-password" component={Page36} />
      <Route path="/forget-password" component={Page37} />
      <Route path="/login" component={Page38} />
      <Route path="/otp" component={Page39} />
      <Route component={NotFound} />
    </Switch>
  </AuthLayout>
);

function AppRouter() {
  const [location] = useLocation();
  const isAuth = location.startsWith('/auth');

  return (
    <RoutedErrorBoundary>
      {isAuth ? (
        <Switch>
          <Route path="/auth" nest component={AuthPages} />
        </Switch>
      ) : (
        <PagesLayout>
          <Switch>
            <Route path="/actor" nest component={ProtectedActorPages} />
            <Route component={LandingPages} />
          </Switch>
        </PagesLayout>
      )}
    </RoutedErrorBoundary>
  );
}

function App() {
  return (
    <Providers>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AppRouter />
      </WouterRouter>
      <Toaster />
    </Providers>
  );
}

export default App;
