import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
  MenuItem,
  dialog,
  SaveDialogOptions,
} from 'electron';
import { t } from 'i18next';
import { appManager } from './app/AppManager';

const fs = require('fs');

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu(): Menu {
    const isDev =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true';
    this.setupContextMenu(isDev);

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);

    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupContextMenu(isDev: boolean = false): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y, selectionText, mediaType, srcURL, formControlType } = props;

      const menu = new Menu();
      if (selectionText) {
        menu.append(
          new MenuItem({
            label: t('copy'),
            role: 'copy',
            accelerator: 'Ctrl+C',
          }),
        );
        menu.append(
          new MenuItem({
            label: t('paste'),
            role: 'paste',
            accelerator: 'Ctrl+V',
          }),
        );
        menu.append(
          new MenuItem({
            label: t('cut'),
            role: 'cut',
            accelerator: 'Ctrl+X',
          }),
        );
        menu.append(
          new MenuItem({
            label: t('selectAll'),
            role: 'selectAll',
            accelerator: 'Ctrl+A',
          }),
        );
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(
          new MenuItem({
            label: t('play'),
            click: () => {
              appManager.tts(selectionText.trim());
            },
          }),
        );
      } else if (mediaType == 'image') {
        menu.append(
          new MenuItem({
            label: t('copy'),
            role: 'copy',
            accelerator: 'Ctrl+C',
          }),
        );
        menu.append(
          new MenuItem({
            label: t('save'),
            accelerator: 'Ctrl+S',
            click: async () => {
              const ext = srcURL.split(';')[0].split('/')[1];

              const arg: SaveDialogOptions = {
                properties: ['createDirectory', 'showOverwriteConfirmation'],
                defaultPath: `image_${new Date().getTime()}.${ext}`,
              };
              const res = await dialog.showSaveDialog(
                this.mainWindow as BrowserWindow,
                arg,
              );

              if (!res.canceled && res.filePath) {
                const base64Data = srcURL.replace(
                  /^data:image\/\w+;base64,/,
                  '',
                );
                const buffer = Buffer.from(base64Data, 'base64');
                fs.writeFile(res.filePath, buffer, (err) => {
                  if (err) {
                    console.error('Failed to save the file:', err);
                  } else {
                    console.log('File saved successfully');
                  }
                });
              }
            },
          }),
        );
      } else {
        menu.append(
          new MenuItem({
            label: t('copy'),
            role: 'copy',
            accelerator: 'Ctrl+C',
          }),
        );
        menu.append(
          new MenuItem({
            label: t('paste'),
            role: 'paste',
            accelerator: 'Ctrl+V',
          }),
        );
        menu.append(
          new MenuItem({
            label: t('cut'),
            role: 'cut',
            accelerator: 'Ctrl+X',
          }),
        );
        menu.append(
          new MenuItem({
            label: t('selectAll'),
            role: 'selectAll',
            accelerator: 'Ctrl+A',
          }),
        );
        menu.append(new MenuItem({ type: 'separator' }));
      }

      if (isDev) {
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(
          new MenuItem({
            label: 'Inspect element',

            click: () => {
              this.mainWindow.webContents.inspectElement(x, y);
            },
          }),
        );
      }
      Menu.buildFromTemplate(menu.items).popup({ window: this.mainWindow });
    });
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: 'Electron',
      submenu: [
        {
          label: 'About ElectronReact',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: 'Hide ElectronReact',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow];
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&File',
        submenu: [
          {
            label: '&Open',
            accelerator: 'Ctrl+O',
          },
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click: () => {
              this.mainWindow.close();
            },
          },
        ],
      },
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
            ? [
                {
                  label: '&Reload',
                  accelerator: 'Ctrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload();
                  },
                },
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
                {
                  label: 'Toggle &Developer Tools',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.mainWindow.webContents.toggleDevTools();
                  },
                },
              ]
            : [
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
              ],
      },
    ];

    return templateDefault;
  }
}
