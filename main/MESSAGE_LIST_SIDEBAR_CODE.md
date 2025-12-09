# 消息列表侧边栏代码片段

## 步骤1：已完成 ✅
以下修改已自动完成：
- 已添加 `createPortal` 导入
- 已添加 `List` 和 `ChevronLeft` 图标
- 已添加 `showMessageList` 状态
- 已添加 `scrollToMessage` 函数

## 步骤2：添加消息列表按钮

在 `ChatInterface.tsx` 文件的第 466 行之前添加以下代码：

```tsx
            {/* 消息列表 */}
            <button
              onClick={() => setShowMessageList(!showMessageList)}
              className="p-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
              title="消息列表"
            >
              <List className="w-5 h-5" />
            </button>

```

**位置**：在 `{/* 法律文库 */}` 注释之前

## 步骤3：添加侧边栏组件

在 `ChatInterface.tsx` 文件的第 902 行（`</motion.div>`）之后，第 904 行（`</div>`）之前添加以下代码：

```tsx
      {/* 左侧消息列表侧边栏 */}
      {showMessageList && createPortal(
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-[99999] flex flex-col border-r border-gray-200"
        >
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <List className="w-5 h-5" />
              消息列表
            </h3>
            <button
              onClick={() => setShowMessageList(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {messages.filter(msg => msg.type === 'user').map((msg) => {
              const actualIndex = messages.findIndex(m => m.id === msg.id);
              return (
                <button
                  key={msg.id}
                  onClick={() => {
                    scrollToMessage(actualIndex);
                    setShowMessageList(false);
                  }}
                  className="w-full text-left p-3 mb-2 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {msg.timestamp.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-900 line-clamp-2">
                    {msg.content}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>,
        document.body
      )}
```

## 功能说明

- **消息列表按钮**：位于header右侧，点击打开/关闭左侧边栏
- **左侧侧边栏**：
  - 使用 Portal 渲染到 body，避免层级问题
  - 从左侧滑入/滑出动画
  - 显示所有用户消息
  - 点击任意消息跳转到对应位置
  - 自动加载历史记录（如果未加载）
  - z-index: 99999 确保在最上层

## 测试步骤

1. 刷新页面
2. 点击header右侧的消息列表图标（List图标）
3. 查看左侧滑出的消息列表
4. 点击任意消息，应该跳转到对应位置并高亮显示
5. 如果之前没有加载历史，应该自动先加载历史记录
