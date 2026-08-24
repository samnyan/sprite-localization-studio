export default {
  app: {
    name: 'Sprite Localization Studio',
  },
  menu: {
    file: 'File',
    newProject: 'New Project',
    openProject: 'Open Project…',
  },
  toolbar: {
    project: 'Project',
    noProject: 'No project',
  },
  workspace: {
    emptyTitle: 'No project open',
    emptyHint: 'Create a project or open an existing folder.',
    newProject: 'New Project',
    openProject: 'Open Project',
    noSprite: 'No sprite selected',
  },
  panel: {
    project: 'Project',
    inspector: 'Inspector',
    atlases: 'Atlases',
    empty: 'Nothing to show',
  },
  project: {
    untitled: 'Untitled Project',
    settings: 'Project Settings',
    name: 'Name',
    schema: 'Schema',
    sourceLocale: 'Source locale',
    targetLocales: 'Target locales',
    notSet: 'Not set',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
  },
  language: {
    label: 'Language',
    en: 'English',
    zhCN: '简体中文',
  },
  theme: {
    light: 'Use light theme',
    dark: 'Use dark theme',
  },
  status: {
    ready: 'Ready',
    opening: 'Opening…',
    saving: 'Saving…',
  },
  errors: {
    unsupportedBrowser: 'Local folders are not supported by this browser.',
    projectNotOpen: 'Open a project first.',
    unknown: 'Operation failed: {message}',
    project: {
      invalidJson: 'project.json is not valid JSON.',
      invalidRoot: 'project.json must contain an object.',
      unsupportedSchema: 'Schema version {version} is not supported.',
      missingName: 'The project name is missing.',
      missingManifest: 'project.json was not found in this folder.',
      emptyName: 'The project name cannot be empty.',
      alreadyExists: 'This folder already contains a project.json file.',
    },
  },
} as const
