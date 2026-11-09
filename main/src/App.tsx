import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AdminProvider, useAdmin } from './contexts/AdminContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ChatInterface from './components/ChatInterface';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import UserLogin from './components/UserLogin';

// 管理员路由保护组件
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { admin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="entry-line">正在校验…</div>
      </div>
    );
  }

  return admin ? <>{children}</> : <Navigate to="/admin/login" replace />;
};

// 已登录管理员访问登录页时重定向
const AdminLoginRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { admin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="entry-line">正在校验…</div>
      </div>
    );
  }

  return admin ? <Navigate to="/admin" replace /> : <>{children}</>;
};

// 用户路由保护组件
const UserRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="entry-line">正在校验…</div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// 已登录用户访问登录页时重定向
const UserLoginRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="entry-line">正在校验…</div>
      </div>
    );
  }

  return user ? <Navigate to="/" replace /> : <>{children}</>;
};

function App() {
  return (
    <UserProvider>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <AdminProvider>
          <Router>
            <div className="App">
              <Routes>
                {/* 用户聊天界面 - 需要登录 */}
                <Route
                  path="/"
                  element={
                    <UserRoute>
                      <ChatInterface />
                    </UserRoute>
                  }
                />

                {/* 用户登录 */}
                <Route
                  path="/login"
                  element={
                    <UserLoginRoute>
                      <UserLogin />
                    </UserLoginRoute>
                  }
                />

                {/* 管理员登录 */}
                <Route
                  path="/admin/login"
                  element={
                    <AdminLoginRoute>
                      <AdminLogin />
                    </AdminLoginRoute>
                  }
                />

                {/* 管理员后台 */}
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />

                {/* 默认重定向 */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>

              {/* Toast 通知 */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                }}
              />
            </div>
          </Router>
        </AdminProvider>
      </ThemeProvider>
    </UserProvider>
  );
}

export default App;