export default {
  app: {
    name: 'Sprite Localization Studio',
  },
  menu: {
    file: '文件',
    newProject: '新建工程',
    openProject: '打开工程…',
  },
  toolbar: {
    project: '工程',
    noProject: '未打开工程',
  },
  workspace: {
    emptyTitle: '未打开工程',
    emptyHint: '新建工程或打开已有工程文件夹。',
    newProject: '新建工程',
    openProject: '打开工程',
    noSprite: '未选择 Sprite',
  },
  panel: {
    project: '工程',
    inspector: '属性',
    atlases: 'Atlases',
    empty: '暂无内容',
  },
  project: {
    untitled: '未命名工程',
    settings: '工程设置',
    name: '名称',
    schema: 'Schema',
    sourceLocale: '源语言',
    targetLocales: '目标语言',
    notSet: '未设置',
    save: '保存',
    saving: '正在保存…',
    saved: '已保存',
  },
  language: {
    label: '语言',
    en: 'English',
    zhCN: '简体中文',
  },
  theme: {
    light: '切换到亮色主题',
    dark: '切换到暗色主题',
  },
  status: {
    ready: '就绪',
    opening: '正在打开…',
    saving: '正在保存…',
  },
  errors: {
    unsupportedBrowser: '当前浏览器不支持本地文件夹。',
    projectNotOpen: '请先打开工程。',
    unknown: '操作失败：{message}',
    project: {
      invalidJson: 'project.json 不是有效的 JSON。',
      invalidRoot: 'project.json 的根节点必须是对象。',
      unsupportedSchema: '不支持 Schema 版本 {version}。',
      missingName: '工程名称缺失。',
      missingManifest: '所选文件夹中没有 project.json。',
      emptyName: '工程名称不能为空。',
      alreadyExists: '所选文件夹中已经存在 project.json。',
    },
  },
} as const
