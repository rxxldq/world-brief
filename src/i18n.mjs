export const locales = {
  en: {
    lang: 'en', daily: 'World Brief', weekly: 'Weekly Perspectives', archive: 'Brief archive',
    contents: 'Contents', search: 'Search this brief (/)', expand: 'Expand all', collapse: 'Collapse all',
    smaller: 'Smaller text', larger: 'Larger text', reference: 'For reference', window: 'Coverage',
    stories: 'stories', sections: 'sections', images: 'images', sources: 'sources',
    confidence: 'Confidence', high: 'High', medium: 'Medium', low: 'Low', bluf: 'Key points',
    watch: 'What to watch', why: 'Assessment', synthesis: 'Perspective summary', original: 'Original',
    imageSource: 'Image source', external: 'external image', method: 'Method and limitations',
    ask: 'Ask AI', copy: 'Copy prompt', close: 'Close', send: 'Send', question: 'Ask about this story…',
    askTitle: 'About: ', copied: 'Copied; paste into your AI assistant', thinking: 'Thinking…',
    unavailable: 'AI unavailable. Use Copy prompt to ask your own assistant.',
    askNote: 'Uses your configured local provider; usage may incur costs. Verify factual claims.',
    offline: 'Offline mode. Copy the prompt to your own assistant.', failed: 'Request failed',
    staticNote: 'Fictional preview. Copy the prompt to your own assistant; no AI provider is connected.',
    chips: ['Explain the background', 'Compare the perspectives', 'What remains unverified?'],
    promptIntro: 'Answer using this news item. Separate facts, attributed claims and inference. Cite sources; disclose uncertainty.',
    defaultQuestion: 'Summarize the significance and the most important uncertainty.',
    camps: { left: 'Left', 'center-left': 'Center-left', center: 'Center', 'center-right': 'Center-right', right: 'Right', 'state-media': 'State media', other: 'Other' }
  },
  zh: {
    lang: 'zh-CN', daily: '世界简报', weekly: '多视角周评', archive: '简报存档',
    contents: '目录', search: '搜索本期（/）', expand: '展开全部', collapse: '折叠全部',
    smaller: '缩小字号', larger: '放大字号', reference: '仅供参阅', window: '覆盖',
    stories: '条要闻', sections: '个板块', images: '张图', sources: '个信源',
    confidence: '可信度', high: '高', medium: '中', low: '低', bluf: '要点摘要',
    watch: '未来关注', why: '研判', synthesis: '光谱小结', original: '原文',
    imageSource: '图源', external: '外链图片', method: '方法与局限',
    ask: '问 AI', copy: '复制提示词', close: '关闭', send: '发送', question: '问这条新闻…',
    askTitle: '问这条：', copied: '已复制，可粘贴到任意 AI', thinking: '思考中…',
    unavailable: 'AI 不可用，请复制提示词后使用自己的助手。',
    askNote: '使用你配置的本机服务，可能产生用量费用；请核实事实。',
    offline: '离线模式，请复制提示词后使用自己的助手。', failed: '请求失败',
    staticNote: '虚构示例预览，未连接模型。请复制提示词后使用自己的助手。',
    chips: ['再讲讲背景', '比较不同立场', '哪些内容尚未核实？'],
    promptIntro: '依据这条新闻回答，区分事实、各方说法与推断，给出来源，不确定就说明。',
    defaultQuestion: '概括事件的重要性与最关键的不确定性。',
    camps: { left: '左翼', 'center-left': '中左', center: '中间', 'center-right': '中右', right: '右翼', 'state-media': '官方/国家媒体', other: '其他' }
  }
};
export function strings(locale) {
  if (!locales[locale]) throw new Error('locale must be en or zh');
  return locales[locale];
}
