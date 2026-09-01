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

// Pages
import Page1 from '@/app/(pages)/(landing)/blog/[id]/page';
import Page2 from '@/app/(pages)/(landing)/blog/page';
import Page3 from '@/app/(pages)/(landing)/page';
import Page4 from '@/app/(pages)/(landing)/success-stories/[id]/page';
import Page5 from '@/app/(pages)/(landing)/success-stories/page';
import Page6 from '@/app/(pages)/actor/(general)/ads/[id]/page';
import Page7 from '@/app/(pages)/actor/(general)/ads/page';
import Page8 from '@/app/(pages)/actor/(general)/delegates/page';
import Page9 from '@/app/(pages)/actor/(general)/displaceds/page';
import Page10 from '@/app/(pages)/actor/(general)/notifications/page';
import Page11 from '@/app/(pages)/actor/(general)/securities/page';
import Page12 from '@/app/(pages)/actor/delegates/[delegate]/aids-management/[aid]/add-displaceds/page';
import Page13 from '@/app/(pages)/actor/delegates/[delegate]/aids-management/[aid]/page';
import Page14 from '@/app/(pages)/actor/delegates/[delegate]/aids-management/page';
import Page15 from '@/app/(pages)/actor/delegates/[delegate]/complaints/page';
import Page16 from '@/app/(pages)/actor/delegates/[delegate]/profile/page';
import Page17 from '@/app/(pages)/actor/delegates/[delegate]/reports/page';
import Page18 from '@/app/(pages)/actor/delegates/add/page';
import Page19 from '@/app/(pages)/actor/displaceds/[displaced]/complaints/page';
import Page20 from '@/app/(pages)/actor/displaceds/[displaced]/profile/page';
import Page21 from '@/app/(pages)/actor/displaceds/[displaced]/received-aids/page';
import Page22 from '@/app/(pages)/actor/displaceds/add/page';
import Page23 from '@/app/(pages)/actor/manager/[manager]/ads-blogs-stories/[id]/page';
import Page24 from '@/app/(pages)/actor/manager/[manager]/ads-blogs-stories/add/page';
import Page25 from '@/app/(pages)/actor/manager/[manager]/ads-blogs-stories/page';
import Page26 from '@/app/(pages)/actor/manager/[manager]/aids-management/[aid]/page';
import Page27 from '@/app/(pages)/actor/manager/[manager]/aids-management/add/page';
import Page28 from '@/app/(pages)/actor/manager/[manager]/aids-management/page';
import Page29 from '@/app/(pages)/actor/manager/[manager]/complaints/page';
import Page30 from '@/app/(pages)/actor/manager/[manager]/profile/page';
import Page31 from '@/app/(pages)/actor/manager/[manager]/reports/page';
import Page32 from '@/app/(pages)/actor/securities/[security]/complaints/page';
import Page33 from '@/app/(pages)/actor/securities/[security]/profile/page';
import Page34 from '@/app/(pages)/actor/securities/[security]/tasks/page';
import Page35 from '@/app/(pages)/actor/securities/add/page';
import Page36 from '@/app/auth/create-new-password/page';
import Page37 from '@/app/auth/forget-password/page';
import Page38 from '@/app/auth/login/page';
import Page39 from '@/app/auth/otp/page';
import Page40 from '@/app/(pages)/actor/staff/page';
import OperationsPage from '@/app/(pages)/actor/operations/page';
import useAuth from '@/hooks/useAuth';
import { AUTH_ROUTES } from '@/constants/routes';
import { canAccessActorPath } from '@/utils/auth/routeAccess';
import FamilyHeadPage from '@/app/(pages)/actor/family/page';

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
      <Route path="/ads/:id" component={Page6} />
      <Route path="/ads" component={Page7} />
      <Route path="/delegates" component={Page8} />
      <Route path="/displaceds" component={Page9} />
      <Route path="/notifications" component={Page10} />
      <Route path="/securities" component={Page11} />
      <Route path="/delegates/:delegate/aids-management/:aid/add-displaceds" component={Page12} />
      <Route path="/delegates/:delegate/aids-management/:aid" component={Page13} />
      <Route path="/delegates/:delegate/aids-management" component={Page14} />
      <Route path="/delegates/:delegate/complaints" component={Page15} />
      <Route path="/delegates/:delegate/profile" component={Page16} />
      <Route path="/delegates/:delegate/reports" component={Page17} />
      <Route path="/delegates/add" component={Page18} />
      <Route path="/displaceds/:displaced/complaints" component={Page19} />
      <Route path="/displaceds/:displaced/profile" component={Page20} />
      <Route path="/displaceds/:displaced/received-aids" component={Page21} />
      <Route path="/displaceds/add" component={Page22} />
      <Route path="/manager/:manager/ads-blogs-stories/:id" component={Page23} />
      <Route path="/manager/:manager/ads-blogs-stories/add" component={Page24} />
      <Route path="/manager/:manager/ads-blogs-stories" component={Page25} />
      <Route path="/manager/:manager/aids-management/:aid" component={Page26} />
      <Route path="/manager/:manager/aids-management/add" component={Page27} />
      <Route path="/manager/:manager/aids-management" component={Page28} />
      <Route path="/manager/:manager/complaints" component={Page29} />
      <Route path="/manager/:manager/profile" component={Page30} />
      <Route path="/manager/:manager/reports" component={Page31} />
      <Route path="/securities/:security/complaints" component={Page32} />
      <Route path="/securities/:security/profile" component={Page33} />
      <Route path="/securities/:security/tasks" component={Page34} />
      <Route path="/securities/add" component={Page35} />
      <Route path="/staff" component={Page40} />
      <Route path="/operations" component={OperationsPage} />
      <Route path="/family" component={FamilyHeadPage} />
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
      جارٍ التحقق من جلسة المستخدم...
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
      <h1 className="text-xl font-semibold">لا تملك صلاحية لهذه الشاشة</h1>
      <p className="text-sm text-muted-foreground">يمكنك الوصول فقط إلى الشاشات المخصصة لدور حسابك.</p>
    </div>
  );
}

function ProtectedActorPages() {
  const [location] = useLocation();
  const { isAuthenticated, isLoading, role, user } = useAuth();
  const actorPath = location === '/actor' || location.startsWith('/actor/')
    ? location
    : `/actor${location.startsWith('/') ? location : `/${location}`}`;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.replace(AUTH_ROUTES.LOGIN);
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) return <AuthLoadingScreen />;
  if (!isAuthenticated || !role || !user) return <AuthLoadingScreen />;
  if (!canAccessActorPath(actorPath, { id: String(user.identity), role })) {
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
