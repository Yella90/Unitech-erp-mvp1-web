import { useState } from 'react';

/**
 * AnimatedTabs - Tab component with fade + slide animation on content change
 * 
 * Props:
 *   - tabs: Array of { id, label, content }
 *   - defaultTabId: string (default first tab)
 *   - onTabChange: function(tabId)
 */
export function AnimatedTabs({ tabs, defaultTabId, onTabChange }) {
  const [activeTabId, setActiveTabId] = useState(defaultTabId || tabs[0]?.id);

  const handleTabChange = (tabId) => {
    if (tabId !== activeTabId) {
      setActiveTabId(tabId);
      onTabChange?.(tabId);
    }
  };

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <div className="w-full">
      {/* Tab Buttons */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1 px-1 sm:px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-2 sm:px-4 text-sm font-medium transition-all-smooth relative ${
                activeTabId === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-600 hover:text-slate-900 border-b-2 border-transparent'
              }`}
            >
              {tab.label}
              {activeTabId === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content with Animation */}
      {activeTab && (
        <div
          key={activeTab.id}
          className="animate-fadeInDown pt-4"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}

export default AnimatedTabs;
