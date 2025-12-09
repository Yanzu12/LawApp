import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Shield, 
  ShieldOff, 
  Trash2, 
  MessageSquare, 
  Calendar,
  Mail,
  User as UserIcon,
  X,
  Loader2,
  Search
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  conversation_count?: number;
}

interface Conversation {
  id: number;
  message_type: string;
  message_content: string;
  created_at: string;
}

interface UserDetailData {
  user: User;
  conversations: Conversation[];
  conversation_count: number;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetailData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list' }
      });

      if (error) throw error;
      setUsers(data.data.users || []);
    } catch (error: any) {
      console.error('加载用户列表失败:', error);
      toast.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'toggle_status', 
          userId, 
          isActive: !currentStatus 
        }
      });

      if (error) throw error;
      
      toast.success(currentStatus ? '用户已禁用' : '用户已启用');
      loadUsers();
    } catch (error: any) {
      console.error('更新用户状态失败:', error);
      toast.error('更新用户状态失败');
    }
  };

  const deleteUser = async (userId: string, username: string) => {
    if (!confirm(`确定要删除用户 "${username}" 吗？此操作不可撤销，该用户的所有对话记录也将被删除。`)) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId }
      });

      if (error) throw error;
      
      toast.success('用户已删除');
      loadUsers();
      if (selectedUser?.user.id === userId) {
        setShowDetail(false);
        setSelectedUser(null);
      }
    } catch (error: any) {
      console.error('删除用户失败:', error);
      toast.error('删除用户失败');
    }
  };

  const viewUserDetail = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'detail', userId }
      });

      if (error) throw error;
      
      setSelectedUser(data.data);
      setShowDetail(true);
    } catch (error: any) {
      console.error('加载用户详情失败:', error);
      toast.error('加载用户详情失败');
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
            <p className="text-sm text-gray-600">管理注册用户和权限</p>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          共 {users.length} 个用户
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索用户名、邮箱或姓名..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* User List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  邮箱
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  对话数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  注册时间
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-white" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.username}
                        </div>
                        {user.full_name && (
                          <div className="text-sm text-gray-500">{user.full_name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Mail className="w-4 h-4 mr-2 text-gray-400" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <MessageSquare className="w-4 h-4 mr-2 text-gray-400" />
                      {user.conversation_count || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? '正常' : '已禁用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(user.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => viewUserDetail(user.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="查看详情"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        className={user.is_active ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}
                        title={user.is_active ? '禁用用户' : '启用用户'}
                      >
                        {user.is_active ? (
                          <ShieldOff className="w-5 h-5" />
                        ) : (
                          <Shield className="w-5 h-5" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.username)}
                        className="text-red-600 hover:text-red-900"
                        title="删除用户"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {searchQuery ? '未找到匹配的用户' : '暂无用户'}
            </div>
          )}
        </div>
      )}

      {/* User Detail Modal */}
      <AnimatePresence>
        {showDetail && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetail(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {selectedUser.user.username}
                    </h3>
                    <p className="text-sm text-gray-600">{selectedUser.user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetail(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* User Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">注册时间</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {new Date(selectedUser.user.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">对话数量</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {selectedUser.conversation_count} 条
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">最后登录</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {selectedUser.user.last_login 
                        ? new Date(selectedUser.user.last_login).toLocaleString('zh-CN')
                        : '未记录'}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">账户状态</div>
                    <div className={`text-lg font-semibold ${
                      selectedUser.user.is_active ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedUser.user.is_active ? '正常' : '已禁用'}
                    </div>
                  </div>
                </div>

                {/* Conversations */}
                <div>
                  <h4 className="text-lg font-bold text-gray-900 mb-4">最近对话记录</h4>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedUser.conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`p-4 rounded-lg ${
                          conv.message_type === 'user'
                            ? 'bg-blue-50 border border-blue-200'
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-semibold ${
                            conv.message_type === 'user' ? 'text-blue-600' : 'text-gray-600'
                          }`}>
                            {conv.message_type === 'user' ? '用户' : 'AI助手'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(conv.created_at).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">
                          {conv.message_content}
                        </p>
                      </div>
                    ))}
                    {selectedUser.conversations.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        暂无对话记录
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;
